import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { execute } from "munim-ffmpeg";

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow access to your photos."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setImageUri(result.assets[0].uri);
        setVideoUri(null);
      }
    } catch (error: any) {
      Alert.alert(
        "Image error",
        error?.message || String(error)
      );
    }
  };

  const createVideo = async () => {
    if (!imageUri) {
      Alert.alert("Select photo", "Please select a photo first.");
      return;
    }

    try {
      setCreating(true);
      setVideoUri(null);

      // FFmpeg најпоузданије ради са обичном локалном путањом.
      const inputPath = imageUri.startsWith("file://")
        ? imageUri.substring(7)
        : imageUri;

      const slash = inputPath.lastIndexOf("/");

      if (slash === -1) {
        throw new Error("Invalid image path.");
      }

      const directory = inputPath.substring(0, slash + 1);

      const outputPath =
        directory + "generated_video_" + Date.now() + ".mp4";

      const args = [
        "-y",

        "-loop",
        "1",

        "-i",
        inputPath,

        "-vf",
        "scale=720:-2,format=yuv420p",

        "-r",
        "30",

        "-t",
        "5",

        "-c:v",
        "libx264",

        "-preset",
        "veryfast",

        "-crf",
        "23",

        "-movflags",
        "+faststart",

        outputPath,
      ];

      const result = await execute(args);

      if (!result.success) {
        throw new Error(
          result.failStackTrace ||
            result.output ||
            "FFmpeg could not create the video."
        );
      }

      const finalUri = "file://" + outputPath;

      setVideoUri(finalUri);

      Alert.alert(
        "Success",
        "Video created successfully."
      );
    } catch (error: any) {
      Alert.alert(
        "Video error",
        error?.message || String(error)
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
    >
      <Text style={styles.title}>
        Free Photo to Video
      </Text>

      <Text style={styles.subtitle}>
        Create videos from your photos
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={pickImage}
        disabled={creating}
      >
        <Text style={styles.buttonText}>
          Choose Photo
        </Text>
      </TouchableOpacity>

      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      )}

      <TouchableOpacity
        style={[
          styles.button,
          styles.createButton,
          (!imageUri || creating) &&
            styles.disabledButton,
        ]}
        onPress={createVideo}
        disabled={!imageUri || creating}
      >
        {creating ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.buttonText}>
              Creating video...
            </Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>
            Create Video
          </Text>
        )}
      </TouchableOpacity>

      {videoUri && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>
            ✓ Video created
          </Text>

          <Text style={styles.pathText}>
            {videoUri}
          </Text>
        </View>
      )}

      <Text style={styles.info}>
        Free • No credits • No generation limit
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#080808",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },

  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
  },

  subtitle: {
    color: "#bbbbbb",
    fontSize: 16,
    marginTop: 8,
    marginBottom: 30,
    textAlign: "center",
  },

  button: {
    width: "100%",
    minHeight: 56,
    backgroundColor: "#6c4cff",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },

  createButton: {
    backgroundColor: "#18a558",
    marginTop: 20,
  },

  disabledButton: {
    opacity: 0.45,
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },

  image: {
    width: "100%",
    height: 420,
    backgroundColor: "#151515",
    borderRadius: 16,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  successBox: {
    width: "100%",
    backgroundColor: "#151515",
    borderRadius: 14,
    padding: 16,
    marginTop: 5,
  },

  successText: {
    color: "#55dd88",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },

  pathText: {
    color: "#888888",
    fontSize: 11,
    marginTop: 8,
  },

  info: {
    color: "#777777",
    marginTop: 30,
    fontSize: 14,
  },
});
