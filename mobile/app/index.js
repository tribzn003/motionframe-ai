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
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { execute } from "munim-ffmpeg";

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState(null);
  const [videoUri, setVideoUri] = useState(null);
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
    } catch (error) {
      Alert.alert(
        "Image error",
        error?.message || String(error)
      );
    }
  };

  const createVideo = async () => {
    if (!imageUri) {
      Alert.alert(
        "Select photo",
        "Please select a photo first."
      );
      return;
    }

    try {
      setCreating(true);
      setVideoUri(null);

      // Permission to save video to gallery
      const mediaPermission =
        await MediaLibrary.requestPermissionsAsync();

      if (!mediaPermission.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow MotionFrame AI to save videos."
        );
        return;
      }

      const inputPath = imageUri.startsWith("file://")
        ? imageUri.substring(7)
        : imageUri;

      // Create video first in app cache
      const fileName =
        "motionframe_" + Date.now() + ".mp4";

      const outputUri =
        FileSystem.cacheDirectory + fileName;

      const outputPath = outputUri.startsWith("file://")
        ? outputUri.substring(7)
        : outputUri;

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
        "libopenh264",

        "-b:v",
        "2M",

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

      // Save completed MP4 to Android Gallery
      const asset =
        await MediaLibrary.createAssetAsync(outputUri);

      // Try to place it in a MotionFrame album
      try {
        const album =
          await MediaLibrary.getAlbumAsync("MotionFrame");

        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync(
            [asset],
            album,
            false
          );
        } else {
          await MediaLibrary.createAlbumAsync(
            "MotionFrame",
            asset,
            false
          );
        }
      } catch (albumError) {
        console.log(
          "Album error:",
          albumError
        );
      }

      setVideoUri(asset.uri);

      Alert.alert(
        "Success",
        "Video created and saved to your Gallery!"
      );
    } catch (error) {
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
        MotionFrame AI
      </Text>

      <Text style={styles.subtitle}>
        Free Photo to Video
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
            <ActivityIndicator
              size="small"
              color="#ffffff"
            />

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
            ✓ Video saved to Gallery
          </Text>

          <Text style={styles.pathText}>
            MotionFrame
          </Text>
        </View>
      )}

      <Text style={styles.info}>
        Free • No credits • Unlimited
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
    fontSize: 17,
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
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
  },

  info: {
    color: "#777777",
    marginTop: 30,
    fontSize: 14,
  },
});
