package com.example.cruz

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform