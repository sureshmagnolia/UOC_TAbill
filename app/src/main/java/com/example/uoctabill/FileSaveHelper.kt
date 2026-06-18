package com.example.uoctabill

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import java.io.OutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FileSaveHelper(private val context: Context) {

    data class SaveResult(val uri: Uri?, val error: String?)

    fun savePdfToDownloads(base64Data: String): SaveResult {
        return try {
            val pdfBytes = Base64.decode(base64Data, Base64.DEFAULT)
            val fileName = "UOC_TABill_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())}.pdf"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver = context.contentResolver
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                if (uri != null) {
                    val outputStream: OutputStream? = resolver.openOutputStream(uri)
                    outputStream?.use { it.write(pdfBytes) }
                    SaveResult(uri, null) // Success with URI
                } else {
                    SaveResult(null, "Failed to create MediaStore entry")
                }
            } else {
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) downloadsDir.mkdirs()
                val file = java.io.File(downloadsDir, fileName)
                java.io.FileOutputStream(file).use { it.write(pdfBytes) }
                val uri = Uri.fromFile(file)
                SaveResult(uri, null) // Success with URI
            }
        } catch (e: Exception) {
            e.printStackTrace()
            SaveResult(null, e.message ?: "Unknown error occurred while saving")
        }
    }
}
