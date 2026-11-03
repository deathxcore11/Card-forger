package dev.cardstashy.nativeplay

import app.cash.zipline.QuickJs
import org.junit.Test

class QjsJobsProbe {
    @Test fun jobs() {
        val q = QuickJs.create()
        q.evaluate("var r = 'none'; var p = {}; globalThis.wait = id => new Promise(res => { p[id] = res; }); (async () => { const v = await wait(1); r = 'got ' + v; })();")
        println("after start: " + q.evaluate("r"))
        q.evaluate("p[1]('x')")
        println("after resolve: " + q.evaluate("r"))
        q.close()
    }
}
