package com.tippingonthego

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.stripeterminalreactnative.TapToPay
import com.stripeterminalreactnative.TerminalApplicationDelegate

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()

    // Tap to Pay runs the contactless kernel in its own isolated process
    // (:stripetaptopay), and Android instantiates this Application there too.
    // Booting React Native inside that process wedges it, so the AIDL service
    // the main process talks to never comes up — the tap then dies with
    // "Failed to send request to AIDL server". Bail out before any init.
    if (TapToPay.isInTapToPayProcess()) { return }

    // Wires up the Terminal SDK's application-level lifecycle. Without it the
    // SDK never binds to that process at all.
    TerminalApplicationDelegate.onCreate(this)

    loadReactNative(this)
  }
}
