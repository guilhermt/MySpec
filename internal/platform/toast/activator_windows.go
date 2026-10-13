package toast

import (
	"fmt"
	"sync"
	"sync/atomic"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// activatorCLSID is the class of the activator of the app, which
// CustomActivator names to the notification platform.
const activatorCLSID = "{A1EC6244-2D8F-49B8-9A4A-549EC594D5AE}"

// The values COM asks for: the class object serves out-of-process clients
// and any number of them, and the HRESULTs the activator answers with.
const (
	clsctxLocalServer   = 4
	regclsMultipleUse   = 1
	sOK                 = 0
	eNoInterface        = 0x80004002
	classENoAggregation = 0x80040110
)

// The slots of the two vtables the activator serves.
const (
	factorySlots  = 5 // IUnknown, CreateInstance, LockServer
	callbackSlots = 4 // IUnknown, Activate
)

var (
	iidUnknown            = mustGUID("{00000000-0000-0000-C000-000000000046}")
	iidClassFactory       = mustGUID("{00000001-0000-0000-C000-000000000046}")
	iidActivationCallback = mustGUID("{53E31837-6600-4A81-9395-75CFFE746F94}")
)

// The activator is state of the package, not of a Toaster: COM keeps its
// objects for as long as the process lives, and syscall.NewCallback never frees
// what it allocates, so the callbacks are made once and the objects are static.
var (
	factoryVtbl  [factorySlots]uintptr
	callbackVtbl [callbackSlots]uintptr
	factory      = classFactory{&factoryVtbl}
	callback     = activationCallback{&callbackVtbl}
	activate     atomic.Pointer[func(uint32)] // what hears the id of a clicked toast
	vtblsOnce    sync.Once

	ole32      = windows.NewLazySystemDLL("ole32.dll")
	coRegister = ole32.NewProc("CoRegisterClassObject")
	coRevoke   = ole32.NewProc("CoRevokeClassObject")
)

// classFactory is the COM object that makes the callback.
type classFactory struct {
	vtbl *[factorySlots]uintptr
}

// activationCallback is the COM object the platform calls on a click.
type activationCallback struct {
	vtbl *[callbackSlots]uintptr
}

func initVtables() {
	vtblsOnce.Do(func() {
		addRef := syscall.NewCallback(func(this uintptr) uintptr { return 1 })
		factoryVtbl = [factorySlots]uintptr{
			syscall.NewCallback(func(this uintptr, riid *windows.GUID, ppv *uintptr) uintptr {
				return answer(this, riid, ppv, &iidClassFactory)
			}),
			addRef,
			addRef,
			syscall.NewCallback(createInstance),
			syscall.NewCallback(func(this, lock uintptr) uintptr { return sOK }),
		}
		callbackVtbl = [callbackSlots]uintptr{
			syscall.NewCallback(func(this uintptr, riid *windows.GUID, ppv *uintptr) uintptr {
				return answer(this, riid, ppv, &iidActivationCallback)
			}),
			addRef,
			addRef,
			syscall.NewCallback(activated),
		}
	})
}

// answer is QueryInterface: the object is IUnknown and the interface it serves.
func answer(this uintptr, riid *windows.GUID, ppv *uintptr, served *windows.GUID) uintptr {
	if *riid == iidUnknown || *riid == *served {
		*ppv = this
		return sOK
	}
	*ppv = 0
	return eNoInterface
}

// createInstance is IClassFactory::CreateInstance: the factory makes the
// callback, the one object, and does not aggregate it.
func createInstance(this, outer uintptr, riid *windows.GUID, ppv *uintptr) uintptr {
	if outer != 0 {
		*ppv = 0
		return classENoAggregation
	}
	return answer(uintptr(unsafe.Pointer(&callback)), riid, ppv, &iidActivationCallback)
}

// activated is INotificationActivationCallback::Activate: the id the clicked
// toast carries goes to the app. It never blocks, since the app only queues it.
func activated(this uintptr, appUserModelID, invokedArgs *uint16, data, count uintptr) uintptr {
	id, ok := parseLaunch(windows.UTF16PtrToString(invokedArgs))
	if !ok {
		return sOK
	}
	if f := activate.Load(); f != nil {
		(*f)(id)
	}
	return sOK
}

// registerActivator makes the app the one that answers the clicks on its
// toasts, with onActivate told the id of each. It runs on the apartment thread.
func registerActivator(onActivate func(uint32)) (cookie uint32, err error) {
	initVtables()
	clsid, err := windows.GUIDFromString(activatorCLSID)
	if err != nil {
		return 0, fmt.Errorf("activator class: %w", err)
	}
	activate.Store(&onActivate)

	r, _, _ := coRegister.Call(uintptr(unsafe.Pointer(&clsid)), uintptr(unsafe.Pointer(&factory)), clsctxLocalServer, regclsMultipleUse, uintptr(unsafe.Pointer(&cookie)))
	if err := hresult(r); err != nil {
		activate.Store(nil)
		return 0, fmt.Errorf("register activator: %w", err)
	}
	return cookie, nil
}

// revokeActivator stops the app from answering clicks.
func revokeActivator(cookie uint32) error {
	r, _, _ := coRevoke.Call(uintptr(cookie))
	activate.Store(nil)
	if err := hresult(r); err != nil {
		return fmt.Errorf("revoke activator: %w", err)
	}
	return nil
}
