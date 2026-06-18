package com.example.uoctabill.data

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class OTAUpdater(private val context: Context) {
    // We use the FullColl branch or main branch URL
    private val remoteUrl = "https://raw.githubusercontent.com/sureshmagnolia/UOC_TAbill/FullColl/ta_database.json"

    suspend fun checkForUpdates() {
        withContext(Dispatchers.IO) {
            try {
                val url = URL(remoteUrl)
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "HEAD"
                connection.connect()

                if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                    val remoteSize = connection.contentLengthLong
                    val localFile = File(context.filesDir, "ta_database.json")
                    
                    // If file doesn't exist, or size is different, download it
                    // (Note: comparing size is a simple heuristic. A better approach uses ETag or Last-Modified)
                    if (!localFile.exists() || localFile.length() != remoteSize) {
                        Log.d("OTAUpdater", "Downloading updated database... (Remote: $remoteSize bytes, Local: ${localFile.length()} bytes)")
                        downloadUpdate(url, localFile)
                    } else {
                        Log.d("OTAUpdater", "Local database is up to date.")
                    }
                }
                connection.disconnect()
            } catch (e: Exception) {
                Log.e("OTAUpdater", "Failed to check for updates: ${e.message}")
            }
        }
    }

    private fun downloadUpdate(url: URL, destinationFile: File) {
        try {
            val connection = url.openConnection() as HttpURLConnection
            connection.connect()

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val input = connection.inputStream
                // Download to a temporary file first to avoid corruption
                val tempFile = File(destinationFile.absolutePath + ".tmp")
                val output = FileOutputStream(tempFile)

                val buffer = ByteArray(8192)
                var bytesRead: Int
                while (input.read(buffer).also { bytesRead = it } != -1) {
                    output.write(buffer, 0, bytesRead)
                }

                output.flush()
                output.close()
                input.close()

                // Replace old file with new file atomically
                tempFile.renameTo(destinationFile)
                Log.d("OTAUpdater", "Database updated successfully.")
            }
        } catch (e: Exception) {
            Log.e("OTAUpdater", "Failed to download update: ${e.message}")
        }
    }
}
