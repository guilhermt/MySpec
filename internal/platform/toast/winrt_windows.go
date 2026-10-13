package toast

import (
	"fmt"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// The classes the toasts use, by their WinRT names.
const (
	classToastManager = "Windows.UI.Notifications.ToastNotificationManager"
	classToast        = "Windows.UI.Notifications.ToastNotification"
	classXMLDocument  = "Windows.Data.Xml.Dom.XmlDocument"
)

// The slots of the vtables. IUnknown takes slots 0 to 2 and IInspectable 3 to
// 5, so the methods of each WinRT interface start at 6.
const (
	slotQueryInterface = 0
	slotRelease        = 2

	slotCreateToastNotifierWithID = 7  // IToastNotificationManagerStatics
	slotGetHistory                = 6  // IToastNotificationManagerStatics2
	slotGetDefault                = 6  // IToastNotificationManagerStatics5
	slotGetNotificationMode       = 6  // IToastNotificationManagerForUser3
	slotRemoveGroupedTagWithID    = 8  // IToastNotificationHistory
	slotClearWithID               = 12 // IToastNotificationHistory
	slotShow                      = 6  // IToastNotifier
	slotGetSetting                = 8  // IToastNotifier
	slotCreateToastNotification   = 6  // IToastNotificationFactory
	slotPutTag                    = 6  // IToastNotification2
	slotPutGroup                  = 8  // IToastNotification2
	slotLoadXML                   = 6  // IXmlDocumentIO
)

// The interfaces the toasts use, by their IIDs.
var (
	iidToastManagerStatics  = mustGUID("{50AC103F-D235-4598-BBEF-98FE4D1A3AD4}")
	iidToastManagerStatics2 = mustGUID("{7AB93C52-0E48-4750-BA9D-1A4113981847}")
	iidToastManagerStatics5 = mustGUID("{D6F5F569-D40D-407C-8989-88CAB42CFD14}")
	iidToastManagerForUser3 = mustGUID("{3EFCB176-6CC1-56DC-973B-251F7AACB1C5}")
	iidToastFactory         = mustGUID("{04124B20-82C6-4229-B109-FD9ED4662B53}")
	iidToast2               = mustGUID("{9DFB9FD1-143A-490E-90BF-B9FBA7132DE7}")
	iidXMLDocumentIO        = mustGUID("{6CD0E74E-EE65-4489-9EBF-CA43E87BA637}")
	iidXMLDocument          = mustGUID("{F7F3A506-1E87-42D6-BCFB-B8C809FA5494}")
)

func mustGUID(s string) windows.GUID {
	g, err := windows.GUIDFromString(s)
	if err != nil {
		panic(fmt.Sprintf("toast: bad GUID %s: %v", s, err))
	}
	return g
}

var (
	combase                      = windows.NewLazySystemDLL("combase.dll")
	roGetActivationFactory       = combase.NewProc("RoGetActivationFactory")
	roActivateInstance           = combase.NewProc("RoActivateInstance")
	windowsCreateString          = combase.NewProc("WindowsCreateString")
	windowsDeleteString          = combase.NewProc("WindowsDeleteString")
	errNoInterface         error = hresultError(eNoInterface)
)

// hresultError is a failed HRESULT.
type hresultError uint32

func (e hresultError) Error() string {
	return fmt.Sprintf("hresult 0x%08X", uint32(e))
}

// hresult turns the return of a call into an error: nil for a success code.
func hresult(r uintptr) error {
	if int32(r) >= 0 {
		return nil
	}
	return hresultError(uint32(r))
}

// object is a COM interface pointer: its first field points at the vtable.
// A pointer an interface hands back is read into an *object.
type object struct {
	vtbl *[32]uintptr
}

// release drops a reference to obj. A nil obj is ignored.
func release(obj *object) {
	if obj == nil {
		return
	}
	_, _, _ = syscall.SyscallN(obj.vtbl[slotRelease], uintptr(unsafe.Pointer(obj)))
}

// queryInterface asks obj for another of its interfaces.
func queryInterface(obj *object, iid *windows.GUID) (*object, error) {
	var out *object
	r, _, _ := syscall.SyscallN(obj.vtbl[slotQueryInterface], uintptr(unsafe.Pointer(obj)), uintptr(unsafe.Pointer(iid)), uintptr(unsafe.Pointer(&out)))
	if err := hresult(r); err != nil {
		return nil, err
	}
	return out, nil
}

// newHString makes an HSTRING of s, which the caller deletes.
func newHString(s string) (uintptr, error) {
	u, err := windows.UTF16FromString(s)
	if err != nil {
		return 0, err
	}
	var h uintptr
	r, _, _ := windowsCreateString.Call(uintptr(unsafe.Pointer(&u[0])), uintptr(len(u)-1), uintptr(unsafe.Pointer(&h)))
	if err := hresult(r); err != nil {
		return 0, fmt.Errorf("create string: %w", err)
	}
	return h, nil
}

func deleteHString(h uintptr) {
	_, _, _ = windowsDeleteString.Call(h)
}

// activationFactory returns the factory of a class as the interface iid.
func activationFactory(class string, iid *windows.GUID) (*object, error) {
	h, err := newHString(class)
	if err != nil {
		return nil, err
	}
	defer deleteHString(h)

	var out *object
	r, _, _ := roGetActivationFactory.Call(h, uintptr(unsafe.Pointer(iid)), uintptr(unsafe.Pointer(&out)))
	if err := hresult(r); err != nil {
		return nil, fmt.Errorf("activation factory of %s: %w", class, err)
	}
	return out, nil
}

// activateInstance makes an instance of a class with a default constructor.
func activateInstance(class string) (*object, error) {
	h, err := newHString(class)
	if err != nil {
		return nil, err
	}
	defer deleteHString(h)

	var out *object
	r, _, _ := roActivateInstance.Call(h, uintptr(unsafe.Pointer(&out)))
	if err := hresult(r); err != nil {
		return nil, fmt.Errorf("activate %s: %w", class, err)
	}
	return out, nil
}

// createToastNotifier makes the notifier of one app.
func createToastNotifier(statics *object, appID string) (*object, error) {
	h, err := newHString(appID)
	if err != nil {
		return nil, err
	}
	defer deleteHString(h)

	var out *object
	r, _, _ := syscall.SyscallN(statics.vtbl[slotCreateToastNotifierWithID], uintptr(unsafe.Pointer(statics)), h, uintptr(unsafe.Pointer(&out)))
	if err := hresult(r); err != nil {
		return nil, err
	}
	return out, nil
}

// getHistory returns the notification history of the user, from the second
// statics interface of the manager.
func getHistory(statics2 *object) (*object, error) {
	var out *object
	r, _, _ := syscall.SyscallN(statics2.vtbl[slotGetHistory], uintptr(unsafe.Pointer(statics2)), uintptr(unsafe.Pointer(&out)))
	if err := hresult(r); err != nil {
		return nil, err
	}
	return out, nil
}

// defaultManager returns the manager of the user who runs the app, from the
// fifth statics interface.
func defaultManager(statics5 *object) (*object, error) {
	var out *object
	r, _, _ := syscall.SyscallN(statics5.vtbl[slotGetDefault], uintptr(unsafe.Pointer(statics5)), uintptr(unsafe.Pointer(&out)))
	if err := hresult(r); err != nil {
		return nil, err
	}
	return out, nil
}

// notificationMode reads the notification mode of the user.
func notificationMode(user3 *object) (int32, error) {
	var mode int32
	r, _, _ := syscall.SyscallN(user3.vtbl[slotGetNotificationMode], uintptr(unsafe.Pointer(user3)), uintptr(unsafe.Pointer(&mode)))
	if err := hresult(r); err != nil {
		return 0, err
	}
	return mode, nil
}

// clearHistory withdraws every toast of one app.
func clearHistory(hist *object, appID string) error {
	h, err := newHString(appID)
	if err != nil {
		return err
	}
	defer deleteHString(h)

	r, _, _ := syscall.SyscallN(hist.vtbl[slotClearWithID], uintptr(unsafe.Pointer(hist)), h)
	return hresult(r)
}

// removeGroupedTag withdraws the toast of one app with a tag and group.
func removeGroupedTag(hist *object, tag, group, appID string) error {
	ht, err := newHString(tag)
	if err != nil {
		return err
	}
	defer deleteHString(ht)
	hg, err := newHString(group)
	if err != nil {
		return err
	}
	defer deleteHString(hg)
	ha, err := newHString(appID)
	if err != nil {
		return err
	}
	defer deleteHString(ha)

	r, _, _ := syscall.SyscallN(hist.vtbl[slotRemoveGroupedTagWithID], uintptr(unsafe.Pointer(hist)), ht, hg, ha)
	return hresult(r)
}

// setting reads whether the notifier may show toasts: 0 is enabled.
func setting(notifier *object) (int32, error) {
	var s int32
	r, _, _ := syscall.SyscallN(notifier.vtbl[slotGetSetting], uintptr(unsafe.Pointer(notifier)), uintptr(unsafe.Pointer(&s)))
	if err := hresult(r); err != nil {
		return 0, err
	}
	return s, nil
}

// show shows a toast.
func show(notifier, toast *object) error {
	r, _, _ := syscall.SyscallN(notifier.vtbl[slotShow], uintptr(unsafe.Pointer(notifier)), uintptr(unsafe.Pointer(toast)))
	return hresult(r)
}

// loadXML fills an XML document, through its IXmlDocumentIO.
func loadXML(docIO *object, xml string) error {
	h, err := newHString(xml)
	if err != nil {
		return err
	}
	defer deleteHString(h)

	r, _, _ := syscall.SyscallN(docIO.vtbl[slotLoadXML], uintptr(unsafe.Pointer(docIO)), h)
	return hresult(r)
}

// createToastNotification makes a toast of an XML document.
func createToastNotification(factory, xmlDoc *object) (*object, error) {
	var out *object
	r, _, _ := syscall.SyscallN(factory.vtbl[slotCreateToastNotification], uintptr(unsafe.Pointer(factory)), uintptr(unsafe.Pointer(xmlDoc)), uintptr(unsafe.Pointer(&out)))
	if err := hresult(r); err != nil {
		return nil, err
	}
	return out, nil
}

// putTag sets the tag of a toast, through its IToastNotification2.
func putTag(toast2 *object, tag string) error {
	h, err := newHString(tag)
	if err != nil {
		return err
	}
	defer deleteHString(h)

	r, _, _ := syscall.SyscallN(toast2.vtbl[slotPutTag], uintptr(unsafe.Pointer(toast2)), h)
	return hresult(r)
}

// putGroup sets the group of a toast, through its IToastNotification2.
func putGroup(toast2 *object, group string) error {
	h, err := newHString(group)
	if err != nil {
		return err
	}
	defer deleteHString(h)

	r, _, _ := syscall.SyscallN(toast2.vtbl[slotPutGroup], uintptr(unsafe.Pointer(toast2)), h)
	return hresult(r)
}
