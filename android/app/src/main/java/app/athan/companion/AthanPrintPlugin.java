package app.athan.companion;

import android.content.Context;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AthanPrint")
public class AthanPrintPlugin extends Plugin {
    private WebView printView;

    @PluginMethod public void print(PluginCall call) {
        String html = call.getString("html");
        if (html == null || html.length() > 5000000) { call.reject("Invalid calendar document"); return; }
        getActivity().runOnUiThread(() -> {
            if (printView != null) { call.reject("Close the current print preview first"); return; }
            WebView view = new WebView(getContext());
            printView = view;
            view.getSettings().setJavaScriptEnabled(false);
            view.getSettings().setAllowFileAccess(false);
            view.getSettings().setBlockNetworkLoads(true);
            view.setWebViewClient(new WebViewClient() {
                private boolean opened = false;
                @Override public void onPageFinished(WebView webView, String url) {
                    if (opened) return;
                    opened = true;
                    try {
                        String name = call.getString("name", "Athan prayer calendar");
                        PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(name);
                        manager.print(name, new PrintDocumentAdapter() {
                            @Override public void onStart() { adapter.onStart(); }
                            @Override public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancellation, LayoutResultCallback callback, android.os.Bundle extras) {
                                adapter.onLayout(oldAttributes, newAttributes, cancellation, callback, extras);
                            }
                            @Override public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancellation, WriteResultCallback callback) {
                                adapter.onWrite(pages, destination, cancellation, callback);
                            }
                            @Override public void onFinish() { adapter.onFinish(); view.destroy(); printView = null; }
                        }, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                        call.resolve();
                    } catch (Exception error) { view.destroy(); printView = null; call.reject("Could not open print preview", error); }
                }
            });
            view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }
}
