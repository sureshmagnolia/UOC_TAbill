package com.example.uoctabill.data

import android.content.Context
import android.content.SharedPreferences

class DataRepository(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("ta_bill_prefs", Context.MODE_PRIVATE)

    fun saveProfile(profile: Profile) {
        prefs.edit()
            .putString("name", profile.name)
            .putString("designation", profile.designation)
            .putString("basicPay", profile.basicPay)
            .putString("acNo", profile.acNo)
            .putString("ifsc", profile.ifsc)
            .putString("address", profile.address)
            .putString("baseCollege", profile.baseCollege)
            .apply()
    }

    fun loadProfile(): Profile {
        return Profile(
            name = prefs.getString("name", "") ?: "",
            designation = prefs.getString("designation", "") ?: "",
            basicPay = prefs.getString("basicPay", "") ?: "",
            acNo = prefs.getString("acNo", "") ?: "",
            ifsc = prefs.getString("ifsc", "") ?: "",
            address = prefs.getString("address", "") ?: "",
            baseCollege = prefs.getString("baseCollege", "") ?: ""
        )
    }
}
