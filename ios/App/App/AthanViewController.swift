import UIKit
import Capacitor

class AthanViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AthanPrintPlugin())
    }
}

@objc(AthanPrintPlugin)
public class AthanPrintPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AthanPrintPlugin"
    public let jsName = "AthanPrint"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise)]

    @objc func print(_ call: CAPPluginCall) {
        guard let html = call.getString("html"), html.utf8.count <= 5000000 else {
            call.reject("Invalid calendar document"); return
        }
        DispatchQueue.main.async {
            let controller = UIPrintInteractionController.shared
            let info = UIPrintInfo(dictionary: nil)
            info.jobName = call.getString("name") ?? "Athan prayer calendar"
            info.outputType = .general
            controller.printInfo = info
            controller.printFormatter = UIMarkupTextPrintFormatter(markupText: html)
            let completion: UIPrintInteractionController.CompletionHandler = { _, _, error in
                if let error = error { call.reject("Could not print calendar", nil, error) }
                else { call.resolve() }
            }
            guard let view = self.bridge?.viewController?.view else { call.reject("Print view is unavailable"); return }
            if UIDevice.current.userInterfaceIdiom == .pad {
                controller.present(from: CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1), in: view, animated: true, completionHandler: completion)
            } else { controller.present(animated: true, completionHandler: completion) }
        }
    }
}
