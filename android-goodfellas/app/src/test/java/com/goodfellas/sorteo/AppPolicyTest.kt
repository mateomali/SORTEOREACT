package com.goodfellas.sorteo

import org.junit.Assert.*
import org.junit.Test

class AppPolicyTest {
    @Test fun trustedAppOnly() {
        listOf("https://www.sudokumerlo.com/sorteo/", "https://sudokumerlo.com/sorteo", "https://www.sudokumerlo.com/sorteo/exportar_fecha.php?id=4").forEach {
            assertTrue(it, AppPolicy.isTrusted(it))
        }
        listOf(null, "http://www.sudokumerlo.com/sorteo/", "https://evil.com/sorteo/", "https://www.sudokumerlo.com.evil.com/sorteo/",
            "https://www.sudokumerlo.com:444/sorteo/", "https://www.sudokumerlo.com/otra-app/", "file:///sorteo/a",
            "https://evil@www.sudokumerlo.com/sorteo/", "https://www.sudokumerlo.com/sorteo/../config.php",
            "https://www.sudokumerlo.com/sorteo/%2e%2e/config.php", "https://www.sudokumerlo.com/sorteo-malicioso").forEach {
            assertFalse(it, AppPolicy.isTrusted(it))
        }
    }
    @Test fun exportNamesCannotEscapeCacheDirectory() {
        assertEquals("equipos.jpg", AppPolicy.filename("../../equipos.jpg"))
        assertEquals("equipos.csv", AppPolicy.filename("C:\\temp\\equipos.csv"))
        assertEquals("goodfellas-exportacion", AppPolicy.filename(".."))
        assertEquals("goodfellas-exportacion", AppPolicy.filename(""))
        assertEquals("a_b_.jpg", AppPolicy.filename("a:b?.jpg"))
        assertEquals(160, AppPolicy.filename("a".repeat(200)).length)
    }
}
