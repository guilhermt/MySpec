package app

// BackgroundFor exposes backgroundFor to the external tests of the package.
var BackgroundFor = backgroundFor

// NewThrottle exposes newThrottle to the external tests of the package.
var NewThrottle = newThrottle

// Request exposes request to the external tests of the package.
func (t *throttle) Request() { t.request() }
