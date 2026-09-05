package app

// applyWebKitEnvironment tunes WebKitGTK before the application starts.
//
// Nothing is needed on the target machine: the rendering checks in the tech
// spec, section 24, all passed with the stock GTK4 and WebKitGTK 6.0 setup, so
// neither WEBKIT_DISABLE_DMABUF_RENDERER nor WEBKIT_DISABLE_COMPOSITING_MODE is
// set here. The function is the place those workarounds go if another machine
// ever needs them.
func applyWebKitEnvironment() {}
