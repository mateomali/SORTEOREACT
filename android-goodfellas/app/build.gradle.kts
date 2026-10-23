plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.goodfellas.sorteo"
    compileSdk = 35
    buildFeatures { buildConfig = true }

    val signingStore = providers.gradleProperty("goodfellasSigningStore").orNull
    val signingPasswordFile = providers.gradleProperty("goodfellasSigningPasswordFile").orNull
    if (signingStore != null && signingPasswordFile != null) {
        signingConfigs.create("goodfellas") {
            storeFile = file(signingStore)
            storePassword = file(signingPasswordFile).readText().trim()
            keyAlias = "goodfellas"
            keyPassword = storePassword
        }
        buildTypes.getByName("release") { signingConfig = signingConfigs.getByName("goodfellas") }
    }

    defaultConfig {
        applicationId = "com.goodfellas.sorteo"
        minSdk = 26
        targetSdk = 34
        versionCode = 4
        versionName = "1.3"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core:1.15.0")
    testImplementation("junit:junit:4.13.2")
}
