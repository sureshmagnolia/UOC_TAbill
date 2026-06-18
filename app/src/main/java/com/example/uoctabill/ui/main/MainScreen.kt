package com.example.uoctabill.ui.main

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.uoctabill.data.Journey
import com.example.uoctabill.data.Profile
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun MainScreen(viewModel: MainScreenViewModel = viewModel()) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val context = LocalContext.current
    val profile by viewModel.profile.collectAsState()
    val journey by viewModel.journey.collectAsState()
    val isGenerating by viewModel.isGenerating.collectAsState()
    val statusMessage by viewModel.statusMessage.collectAsState()
    val colleges by viewModel.colleges.collectAsState()
    val designations = viewModel.designations
    val savedPdfUri by viewModel.savedPdfUri.collectAsState()

    // Show "Open PDF?" dialog whenever a new PDF is saved
    if (savedPdfUri != null) {
        AlertDialog(
            onDismissRequest = { viewModel.clearSavedPdfUri() },
            title = { Text("PDF Saved") },
            text = { Text("PDF saved to Downloads. Open it now?") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.clearSavedPdfUri()
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(savedPdfUri, "application/pdf")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    try {
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        // No PDF viewer installed
                        viewModel.statusMessage.value = "No PDF viewer app found. Check Downloads."
                    }
                }) { Text("Open") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.clearSavedPdfUri() }) { Text("Later") }
            }
        )
    }

    Scaffold(
        topBar = {
            @OptIn(ExperimentalMaterial3Api::class)
            TopAppBar(title = { Text("TA Bill Generator") })
        },
        floatingActionButton = {
            if (selectedTab == 1) {
                val permissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
                    androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
                ) { isGranted ->
                    if (isGranted) {
                        viewModel.generatePdf()
                    } else {
                        viewModel.statusMessage.value = "Storage permission required to save PDF."
                    }
                }
                FloatingActionButton(
                    onClick = { 
                        if (journey.fromCollege.isBlank() || journey.toCollege.isBlank() || journey.dateOnward.isBlank() || journey.timeOnward.isBlank()) {
                            viewModel.statusMessage.value = "Error: Please select From/To colleges, onward date and time."
                        } else {
                            if (android.os.Build.VERSION.SDK_INT <= android.os.Build.VERSION_CODES.P) {
                                permissionLauncher.launch(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                            } else {
                                viewModel.generatePdf() 
                            }
                        }
                    }
                ) {
                    Text(if (isGenerating) "Generating..." else "Generate PDF", modifier = Modifier.padding(horizontal = 16.dp))
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .padding(16.dp)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
        ) {
            TabRow(selectedTabIndex = selectedTab) {
                Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Profile") })
                Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Journey") })
            }
            Spacer(Modifier.height(16.dp))
            if (statusMessage.isNotEmpty()) {
                Text(statusMessage, color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(16.dp))
            }

            if (selectedTab == 0) {
                ProfileForm(profile = profile, designations = designations, colleges = colleges, onUpdate = { viewModel.updateProfile(it) }, onNext = { selectedTab = 1 })
            } else {
                JourneyForm(journey = journey, colleges = colleges, onUpdate = { viewModel.updateJourney(it) })
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CollegeDropdownField(value: String, options: List<Pair<String, String>>, label: String, onValueChange: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    var searchText by remember(value) { mutableStateOf(options.find { it.second == value }?.first ?: value) }
    
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it }
    ) {
        OutlinedTextField(
            value = searchText,
            onValueChange = { 
                searchText = it
                expanded = true
            },
            label = { Text(label) },
            modifier = Modifier.fillMaxWidth().menuAnchor(),
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
        )
        if (options.isNotEmpty() && expanded) {
            val filteredOptions = options.filter { it.first.contains(searchText, ignoreCase = true) || it.second.contains(searchText, ignoreCase = true) }.take(10)
            if (filteredOptions.isNotEmpty()) {
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    filteredOptions.forEach { selectionOption ->
                        DropdownMenuItem(
                            text = { Text("${selectionOption.first} (${selectionOption.second})") },
                            onClick = {
                                searchText = selectionOption.first
                                onValueChange(selectionOption.second)
                                expanded = false
                            }
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownField(value: String, options: List<String>, label: String, onValueChange: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it }
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = { 
                onValueChange(it) 
                expanded = true
            },
            label = { Text(label) },
            modifier = Modifier.fillMaxWidth().menuAnchor(),
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
        )
        if (options.isNotEmpty() && expanded) {
            val filteredOptions = options.filter { it.contains(value, ignoreCase = true) }.take(10)
            if (filteredOptions.isNotEmpty()) {
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    filteredOptions.forEach { selectionOption ->
                        DropdownMenuItem(
                            text = { Text(selectionOption) },
                            onClick = {
                                onValueChange(selectionOption)
                                expanded = false
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ProfileForm(profile: Profile, designations: List<String>, colleges: List<Pair<String, String>>, onUpdate: (Profile) -> Unit, onNext: () -> Unit) {
    OutlinedTextField(value = profile.name, onValueChange = { onUpdate(profile.copy(name = it)) }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth())
    DropdownField(value = profile.designation, options = designations, label = "Designation", onValueChange = { onUpdate(profile.copy(designation = it)) })
    CollegeDropdownField(value = profile.baseCollege, options = colleges, label = "Base College", onValueChange = { onUpdate(profile.copy(baseCollege = it)) })
    OutlinedTextField(value = profile.basicPay, onValueChange = { onUpdate(profile.copy(basicPay = it)) }, label = { Text("Basic Pay") }, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(value = profile.acNo, onValueChange = { onUpdate(profile.copy(acNo = it)) }, label = { Text("Account No") }, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(value = profile.ifsc, onValueChange = { onUpdate(profile.copy(ifsc = it)) }, label = { Text("IFSC") }, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(value = profile.address, onValueChange = { onUpdate(profile.copy(address = it)) }, label = { Text("Address") }, modifier = Modifier.fillMaxWidth())
    Spacer(Modifier.height(16.dp))
    Button(onClick = onNext, modifier = Modifier.fillMaxWidth()) {
        Text("Save & Proceed to Journey")
    }
}

@Composable
fun JourneyForm(journey: Journey, colleges: List<Pair<String, String>>, onUpdate: (Journey) -> Unit) {
    CollegeDropdownField(value = journey.fromCollege, options = colleges, label = "From College", onValueChange = { onUpdate(journey.copy(fromCollege = it)) })
    CollegeDropdownField(value = journey.toCollege, options = colleges, label = "To College", onValueChange = { onUpdate(journey.copy(toCollege = it)) })
    Row(Modifier.fillMaxWidth()) {
        Box(modifier = Modifier.weight(1f)) {
            DatePickerField(value = journey.dateOnward, label = "Onward Date", onValueChange = { onUpdate(journey.copy(dateOnward = it)) })
        }
        Spacer(Modifier.width(8.dp))
        Box(modifier = Modifier.weight(1f)) {
            TimePickerField(value = journey.timeOnward, label = "Onward Time", onValueChange = { onUpdate(journey.copy(timeOnward = it)) })
        }
    }
    Row(Modifier.fillMaxWidth()) {
        Box(modifier = Modifier.weight(1f)) {
            DatePickerField(value = journey.dateReturn, label = "Return Date", onValueChange = { onUpdate(journey.copy(dateReturn = it)) })
        }
        Spacer(Modifier.width(8.dp))
        Box(modifier = Modifier.weight(1f)) {
            TimePickerField(value = journey.timeReturn, label = "Return Time", onValueChange = { onUpdate(journey.copy(timeReturn = it)) })
        }
    }
    OutlinedTextField(value = journey.purpose, onValueChange = { onUpdate(journey.copy(purpose = it)) }, label = { Text("Purpose") }, modifier = Modifier.fillMaxWidth())
    Spacer(Modifier.height(80.dp))
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DatePickerField(value: String, label: String, onValueChange: (String) -> Unit) {
    var showDialog by remember { mutableStateOf(false) }
    val datePickerState = rememberDatePickerState()
    
    if (showDialog) {
        DatePickerDialog(
            onDismissRequest = { showDialog = false },
            confirmButton = {
                TextButton(onClick = {
                    showDialog = false
                    datePickerState.selectedDateMillis?.let { millis ->
                        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                        onValueChange(sdf.format(Date(millis)))
                    }
                }) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDialog = false }) {
                    Text("Cancel")
                }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    OutlinedTextField(
        value = value,
        onValueChange = { onValueChange(it) },
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        trailingIcon = {
            TextButton(onClick = { showDialog = true }) {
                Text("Pick")
            }
        },
        readOnly = true
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimePickerField(value: String, label: String, onValueChange: (String) -> Unit) {
    var showDialog by remember { mutableStateOf(false) }
    val timePickerState = rememberTimePickerState()
    
    if (showDialog) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showDialog = false },
            confirmButton = {
                TextButton(onClick = {
                    showDialog = false
                    val hour = String.format(Locale.US, "%02d", timePickerState.hour)
                    val minute = String.format(Locale.US, "%02d", timePickerState.minute)
                    onValueChange("$hour:$minute")
                }) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDialog = false }) {
                    Text("Cancel")
                }
            },
            title = { Text("Select Time") },
            text = {
                TimePicker(state = timePickerState)
            }
        )
    }

    OutlinedTextField(
        value = value,
        onValueChange = { onValueChange(it) },
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        trailingIcon = {
            TextButton(onClick = { showDialog = true }) {
                Text("Pick")
            }
        },
        readOnly = true
    )
}
