package com.example.uoctabill.data

import org.json.JSONObject

data class Profile(
    val name: String = "",
    val designation: String = "",
    val basicPay: String = "",
    val acNo: String = "",
    val ifsc: String = "",
    val address: String = "",
    val baseCollege: String = ""
) {
    fun toJsonString(): String {
        return JSONObject().apply {
            put("name", name)
            put("designation", designation)
            put("basicPay", basicPay)
            put("acNo", acNo)
            put("ifsc", ifsc)
            put("address", address)
            put("baseCollege", baseCollege)
        }.toString()
    }
}

data class Journey(
    val fromCollege: String = "",
    val toCollege: String = "",
    val dateOnward: String = "",
    val timeOnward: String = "",
    val dateReturn: String = "",
    val timeReturn: String = "",
    val purpose: String = ""
) {
    fun toJsonString(): String {
        return JSONObject().apply {
            put("fromCollege", fromCollege)
            put("toCollege", toCollege)
            put("dateOnward", dateOnward)
            put("timeOnward", timeOnward)
            put("dateReturn", dateReturn)
            put("timeReturn", timeReturn)
            put("purpose", purpose)
        }.toString()
    }
}
