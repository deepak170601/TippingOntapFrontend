package com.tippingonthego

import android.app.Application
import android.os.Build
import android.util.Log
import android.webkit.WebView
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

    // Tap to Pay runs its contactless kernel in a second process
    // (:stripetaptopay), and Android builds this Application there too — so
    // without a guard everything below runs twice, once in a process that
    // needs none of it.
    //
    // Two processes of one app may not share a WebView data directory. If both
    // reach for one the loser is killed, and that takes down the AIDL service
    // the main process drives the card reader through — which surfaces as
    // "Failed to send request to AIDL server" the moment a card is tapped.
    // So give that process a directory of its own before anything can load a
    // WebView there, then skip our own startup entirely.
    if (TapToPay.isInTapToPayProcess()) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        try {
          WebView.setDataDirectorySuffix("stripetaptopay")
        } catch (e: IllegalStateException) {
          // Something already loaded a WebView here, so the directory is
          // fixed for this process and there is nothing left to claim.
          Log.w("MainApplication", "WebView data dir already in use", e)
        }
      }
      return
    }

    // The RN module already calls this on every initialize(), so it is
    // belt-and-braces — but it is what Stripe's own setup installs, and it
    // is idempotent.
    TerminalApplicationDelegate.onCreate(this)

    loadReactNative(this)
  }
}
