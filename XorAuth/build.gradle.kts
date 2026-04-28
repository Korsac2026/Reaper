plugins {
    id("java")
    id("com.github.johnrengelman.shadow") version "8.1.1"
}

group = "dev.obamaruntz"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.j256.ormlite:ormlite-jdbc:6.1")
    implementation("io.javalin:javalin:6.7.0")
    implementation("org.slf4j:slf4j-simple:2.0.17")
    implementation("mysql:mysql-connector-java:8.0.33")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.1")
    implementation("org.json:json:20240303")
    implementation("org.xerial:sqlite-jdbc:3.36.0.3")
    implementation("io.javalin.community.ssl:ssl-plugin:6.7.0")
    implementation("org.conscrypt:conscrypt-openjdk-uber:2.5.2")
}

tasks {
    shadowJar {
        archiveBaseName.set("XorAuth")
        archiveVersion.set("1.0-SNAPSHOT")
        manifest {
            attributes["Main-Class"] = "dev.obamaruntz.Main"
        }
    }
}
