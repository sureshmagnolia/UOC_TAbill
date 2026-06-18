package com.example.uoctabill

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

class PdfGeneratorHelper(private val context: Context) {
    private var webView: WebView? = null
    private var isPageLoaded = false
    private var currentContinuation: kotlinx.coroutines.CancellableContinuation<String?>? = null

    @SuppressLint("SetJavaScriptEnabled")
    fun initialize() {
        Handler(Looper.getMainLooper()).post {
            webView = WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
                settings.allowFileAccess = true
                settings.allowContentAccess = true
                @Suppress("DEPRECATION")
                settings.allowFileAccessFromFileURLs = true
                @Suppress("DEPRECATION")
                settings.allowUniversalAccessFromFileURLs = true

                addJavascriptInterface(object : Any() {
                    @JavascriptInterface
                    fun onPdfGenerated(base64: String?) {
                        val cont = currentContinuation
                        currentContinuation = null
                        if (cont?.isActive == true) {
                            cont.resume(base64)
                        }
                    }
                }, "AndroidBridge")

                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        isPageLoaded = true
                    }

                    override fun shouldInterceptRequest(
                        view: WebView?,
                        request: WebResourceRequest?
                    ): WebResourceResponse? {
                        val urlStr = request?.url?.toString() ?: ""
                        // Determine which asset file to serve
                        val assetPath: String? = when {
                            urlStr.endsWith("ta_abbrevs.json") -> "ta_abbrevs.json"
                            urlStr.contains("/routes/") -> {
                                val fileName = urlStr.substringAfterLast("/routes/")
                                "routes/$fileName"
                            }
                            // Legacy fallback for ta_database.json
                            urlStr.endsWith("ta_database.json") -> "ta_database.json"
                            else -> null
                        }

                        if (assetPath != null) {
                            try {
                                val stream = context.assets.open(assetPath)
                                return WebResourceResponse("application/json", "UTF-8", stream)
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                        return super.shouldInterceptRequest(view, request)
                    }
                }

                loadUrl("file:///android_asset/index.html")
            }
        }
    }

    suspend fun generatePdf(profileJson: String, journeysJson: String): String? =
        suspendCancellableCoroutine { continuation ->
            Handler(Looper.getMainLooper()).post {
                if (webView == null) {
                    continuation.resume("ERROR: WebView is null")
                    return@post
                }

                currentContinuation = continuation

                // Pass the two small JSONs directly. DB is loaded by fetch() inside the page.
                val escapedProfile = escapeForJs(profileJson)
                val escapedJourney = escapeForJs(journeysJson)
                val script = "window.generatePdfFromAndroid('$escapedProfile', '$escapedJourney');"
                webView?.evaluateJavascript(script, null)
            }
        }

    /**
     * Escape a JSON string so it can be safely embedded inside JS single-quoted string literals.
     * Only escapes backslash and single-quote; newlines are already absent in JSON.
     */
    private fun escapeForJs(json: String): String {
        return json
            .replace("\\", "\\\\")   // must be first
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "")
    }
}
