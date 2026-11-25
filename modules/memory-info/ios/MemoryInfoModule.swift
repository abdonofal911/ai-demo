import ExpoModulesCore
import UIKit
import os

public class MemoryInfoModule: Module {
  private var memoryWarningObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("MemoryInfo")

    Events("onMemoryPressure")

    AsyncFunction("getMemoryAsync") { () -> [String: Any] in
      // phys_footprint is the number iOS uses when deciding to kill an app for memory.
      var info = task_vm_info_data_t()
      var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
      let result = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
          task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
        }
      }
      let used = result == KERN_SUCCESS ? Int64(info.phys_footprint) : 0

      return [
        "appUsedBytes": used,
        // On iOS this is how much more this app may use before being killed.
        "availableBytes": Int64(os_proc_available_memory()),
        "totalBytes": Int64(ProcessInfo.processInfo.physicalMemory),
        "lowMemory": false,
      ]
    }

    OnCreate {
      self.memoryWarningObserver = NotificationCenter.default.addObserver(
        forName: UIApplication.didReceiveMemoryWarningNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onMemoryPressure", ["level": 15, "critical": true])
      }
    }

    OnDestroy {
      if let observer = self.memoryWarningObserver {
        NotificationCenter.default.removeObserver(observer)
      }
      self.memoryWarningObserver = nil
    }
  }
}
