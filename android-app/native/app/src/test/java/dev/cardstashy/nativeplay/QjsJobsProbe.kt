package dev.cardstashy.nativeplay

import app.cash.zipline.QuickJs
import org.junit.Test
import java.io.File

class QjsJobsProbe {
    @Test fun run() {
        val q = QuickJs.create(); q.maxStackSize = 6L shl 20
        q.evaluate(File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/random-build.js").readText(), "random-build.js")
        q.evaluate("RandomBuild.start(JSON.stringify({format:'Standard'}))")
        repeat(5) { println("pump: " + (q.evaluate("__host.pump(Date.now())") as String).take(300)) }
        println("poll: " + q.evaluate("RandomBuild.poll()"))
        println("last: " + q.evaluate("String(globalThis.__lastError)"))
        q.close()
    }
}
