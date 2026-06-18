package com.example.uoctabill.ui.main

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.uoctabill.PdfGeneratorHelper
import com.example.uoctabill.FileSaveHelper
import com.example.uoctabill.data.DataRepository
import com.example.uoctabill.data.Journey
import com.example.uoctabill.data.Profile
import com.example.uoctabill.data.OTAUpdater
import android.util.JsonReader
import java.io.InputStreamReader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class MainScreenViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = DataRepository(application)
    private val pdfGenerator = PdfGeneratorHelper(application).apply { initialize() }
    private val fileSaveHelper = FileSaveHelper(application)
    private val otaUpdater = OTAUpdater(application)

    private val _colleges = MutableStateFlow<List<Pair<String, String>>>(emptyList())
    val colleges: StateFlow<List<Pair<String, String>>> = _colleges

    val designations = listOf("Assistant Professor", "Associate Professor", "Professor", "Principal", "Guest Lecturer", "Section Officer", "Assistant", "Other")

    private val _profile = MutableStateFlow(Profile())
    val profile: StateFlow<Profile> = _profile

    private val _journey = MutableStateFlow(Journey())
    val journey: StateFlow<Journey> = _journey

    private val _isGenerating = MutableStateFlow(false)
    val isGenerating: StateFlow<Boolean> = _isGenerating

    val statusMessage = MutableStateFlow("")

    // Emits the URI of a freshly saved PDF so the UI can prompt to open it
    private val _savedPdfUri = MutableStateFlow<Uri?>(null)
    val savedPdfUri: StateFlow<Uri?> = _savedPdfUri

    fun clearSavedPdfUri() { _savedPdfUri.value = null }

    init {
        val prefs = application.getSharedPreferences("ta_prefs", android.content.Context.MODE_PRIVATE)
        _profile.value = Profile(
            name = prefs.getString("name", "") ?: "",
            designation = prefs.getString("designation", "") ?: "",
            baseCollege = prefs.getString("baseCollege", "") ?: "",
            basicPay = prefs.getString("basicPay", "") ?: "",
            acNo = prefs.getString("acNo", "") ?: "",
            ifsc = prefs.getString("ifsc", "") ?: "",
            address = prefs.getString("address", "") ?: ""
        )
        _journey.value = Journey(
            fromCollege = prefs.getString("j_fromCollege", _profile.value.baseCollege) ?: _profile.value.baseCollege,
            toCollege = prefs.getString("j_toCollege", "") ?: "",
            dateOnward = prefs.getString("j_dateOnward", "") ?: "",
            timeOnward = prefs.getString("j_timeOnward", "") ?: "",
            dateReturn = prefs.getString("j_dateReturn", "") ?: "",
            timeReturn = prefs.getString("j_timeReturn", "") ?: "",
            purpose = prefs.getString("j_purpose", "") ?: ""
        )

        viewModelScope.launch(Dispatchers.IO) {
            loadColleges()
            otaUpdater.checkForUpdates()
        }
    }

    private fun loadColleges() {
        try {
            val localFile = java.io.File(getApplication<Application>().filesDir, "ta_abbrevs.json")
            val inputStream = if (localFile.exists()) {
                java.io.FileInputStream(localFile)
            } else {
                getApplication<Application>().assets.open("ta_abbrevs.json")
            }
            val reader = JsonReader(InputStreamReader(inputStream, "UTF-8"))
            val list = mutableListOf<Pair<String, String>>()
            val seenNames = mutableSetOf<String>()
            
            reader.beginArray()
            while (reader.hasNext()) {
                reader.beginObject()
                var abbreviation = ""
                var fullName = ""
                while (reader.hasNext()) {
                    val key = reader.nextName()
                    if (key == "Abbreviation") {
                        abbreviation = reader.nextString()
                    } else if (key == "Full College Name & Location") {
                        fullName = reader.nextString()
                    } else {
                        reader.skipValue()
                    }
                }
                reader.endObject()
                if (abbreviation.isNotEmpty() && fullName.isNotEmpty()) {
                    val nameNorm = fullName.lowercase()
                        .replace("govt.", "government")
                        .replace(Regex("[^a-z0-9]"), "")
                    if (!seenNames.contains(nameNorm)) {
                        seenNames.add(nameNorm)
                        list.add(Pair(fullName, abbreviation))
                    }
                }
            }
            reader.endArray()
            reader.close()

            _colleges.value = list.sortedBy { it.first }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun saveProfileToPrefs(profile: Profile) {
        val prefs = getApplication<Application>().getSharedPreferences("ta_prefs", android.content.Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString("name", profile.name)
            putString("designation", profile.designation)
            putString("baseCollege", profile.baseCollege)
            putString("basicPay", profile.basicPay)
            putString("acNo", profile.acNo)
            putString("ifsc", profile.ifsc)
            putString("address", profile.address)
            apply()
        }
    }

    private fun saveJourneyToPrefs(journey: Journey) {
        val prefs = getApplication<Application>().getSharedPreferences("ta_prefs", android.content.Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString("j_fromCollege", journey.fromCollege)
            putString("j_toCollege", journey.toCollege)
            putString("j_dateOnward", journey.dateOnward)
            putString("j_timeOnward", journey.timeOnward)
            putString("j_dateReturn", journey.dateReturn)
            putString("j_timeReturn", journey.timeReturn)
            putString("j_purpose", journey.purpose)
            apply()
        }
    }

    fun updateProfile(newProfile: Profile) {
        _profile.value = newProfile
        saveProfileToPrefs(newProfile)
    }

    fun updateJourney(newJourney: Journey) {
        _journey.value = newJourney
        saveJourneyToPrefs(newJourney)
    }

    fun generatePdf() {
        if (_isGenerating.value) return
        _isGenerating.value = true
        statusMessage.value = "Generating PDF..."
        
        viewModelScope.launch(Dispatchers.IO) {
            val base64 = pdfGenerator.generatePdf(_profile.value.toJsonString(), _journey.value.toJsonString())

            if (base64 != null && !base64.startsWith("ERROR")) {
                val result = fileSaveHelper.savePdfToDownloads(base64)
                if (result.error == null && result.uri != null) {
                    statusMessage.value = "PDF saved to Downloads!"
                    _savedPdfUri.value = result.uri
                } else {
                    statusMessage.value = "Failed to save PDF: ${result.error}"
                }
            } else {
                statusMessage.value = "Error generating PDF: $base64"
            }
            _isGenerating.value = false
        }
    }
}
