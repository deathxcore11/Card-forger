package dev.cardstashy.nativeplay

import java.io.File

/** The Play progress state the home tests draw: the parity fixture when it is on disk, else the small copy in test resources. */
fun progressStateText(): String =
    File("/mnt/project-files/design/native/parity/fixtures/progress-state.json").takeIf { it.exists() }?.readText()
        ?: object {}.javaClass.classLoader!!.getResource("progress-state.json")!!.readText()
