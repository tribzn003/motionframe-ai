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
  TextInput,
  Linking,
} from "react-native";

import * as ImagePicker from "expo-image-picker";

const API_URL = "https://motionframe-ai.onrender.com";

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState(null);
  const [imageType, setImageType] = useState("image/jpeg");
  const [imageName, setImageName] = useState("photo.jpg");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [creating, setCreating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [videoUrl, setVideoUrl] = useState(null);

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

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 1,
        });

      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];

        setImageUri(asset.uri);
        setImageType(asset.mimeType || "image/jpeg");
        setImageName(asset.fileName || "photo.jpg");
        setVideoUrl(null);
        setStatusText("");
      }
    } catch (error) {
      Alert.alert(
        "Error",
        "Could not select the photo."
      );
    }
  };

  const selectDuration = (seconds) => {
    if (seconds > 5) {
      Alert.alert(
        "Premium",
        `${seconds} second videos are a Premium feature.`
      );
      return;
    }

    setDuration(seconds);
  };

  const checkService = async () => {
    const response = await fetch(`${API_URL}/status`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        "Could not connect to MotionFrame AI."
      );
    }

    return result;
  };

  const checkTaskUntilFinished = async (taskId) => {
    for (let attempt = 0; attempt < 180; attempt++) {
      setStatusText("AI is creating your video...");

      const response = await fetch(
        `${API_URL}/tasks/${taskId}`
      );

      const task = await response.json();

      if (!response.ok) {
        throw new Error(
          task?.detail ||
            "Could not check video status."
        );
      }

      if (task.status === "SUCCEEDED") {
        if (
          Array.isArray(task.output) &&
          task.output.length > 0
        ) {
          return task.output[0];
        }

        throw new Error(
          "Video finished but no output URL was returned."
        );
      }

      if (
        task.status === "FAILED" ||
        task.status === "CANCELLED"
      ) {
        throw new Error(
          task.failure ||
            "AI video generation failed."
        );
      }

      await sleep(5000);
    }

    throw new Error(
      "Video generation took too long."
    );
  };

  const generateVideo = async () => {
    if (!imageUri) {
      Alert.alert(
        "Select a photo",
        "Please select a photo first."
      );
      return;
    }

    if (!prompt.trim()) {
      Alert.alert(
        "Describe the animation",
        "Write what you want to happen in the video."
      );
      return;
    }

    if (duration > 5) {
      Alert.alert(
        "Premium",
        "Videos longer than 5 seconds require Premium."
      );
      return;
    }

    setCreating(true);
    setVideoUrl(null);
    setStatusText("Checking AI service...");

    try {
      const service = await checkService();

      if (!service.generation_ready) {
        Alert.alert(
          "AI engine not connected",
          "MotionFrame AI video engine is not connected."
        );
        return;
      }

      setStatusText("Uploading photo...");

      const formData = new FormData();

      formData.append("image", {
        uri: imageUri,
        name: imageName,
        type: imageType,
      });

      formData.append("prompt", prompt.trim());
      formData.append("duration", "5");

      const response = await fetch(
        `${API_URL}/generate`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result?.detail === "string"
            ? result.detail
            : "Could not start video generation."
        );
      }

      if (!result.task_id) {
        throw new Error(
          "Server did not return a task ID."
        );
      }

      setStatusText("Creating 5 second video...");

      const finishedVideoUrl =
        await checkTaskUntilFinished(result.task_id);

      setVideoUrl(finishedVideoUrl);
      setStatusText("Video is ready!");

      Alert.alert(
        "Video ready",
        "Your 5 second AI video has been generated."
      );
    } catch (error) {
      setStatusText("");

      Alert.alert(
        "Error",
        error?.message ||
          "Could not connect to MotionFrame AI."
      );
    } finally {
      setCreating(false);
    }
  };

  const openVideo = async () => {
    if (!videoUrl) return;

    try {
      await Linking.openURL(videoUrl);
    } catch (error) {
      Alert.alert(
        "Error",
        "Could not open the generated video."
      );
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        MotionFrame AI
      </Text>

      <Text style={styles.subtitle}>
        Turn a photo into an AI video
      </Text>

      <TouchableOpacity
        style={styles.photoButton}
        onPress={pickImage}
        disabled={creating}
      >
        <Text style={styles.photoButtonText}>
          Select Photo
        </Text>
      </TouchableOpacity>

      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      )}

      <Text style={styles.label}>
        Describe the animation
      </Text>

      <TextInput
        style={styles.promptInput}
        placeholder="Example: The person smiles and slowly walks away..."
        placeholderTextColor="#888"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        textAlignVertical="top"
        editable={!creating}
      />

      <Text style={styles.label}>
        Video duration
      </Text>

      <View style={styles.durationRow}>
        <TouchableOpacity
          style={[
            styles.durationButton,
            styles.durationButtonActive,
          ]}
          onPress={() => selectDuration(5)}
        >
          <Text style={styles.durationTextActive}>
            5 s
          </Text>
          <Text style={styles.freeText}>
            FREE
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.durationButton}
          onPress={() => selectDuration(10)}
        >
          <Text style={styles.durationText}>
            10 s
          </Text>
          <Text style={styles.premiumText}>
            PREMIUM
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.durationButton}
          onPress={() => selectDuration(15)}
        >
          <Text style={styles.durationText}>
            15 s
          </Text>
          <Text style={styles.premiumText}>
            PREMIUM
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.generateButton,
          creating && styles.disabledButton,
        ]}
        onPress={generateVideo}
        disabled={creating}
      >
        {creating ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator
              size="small"
              color="#ffffff"
            />
            <Text style={styles.loadingText}>
              Creating...
            </Text>
          </View>
        ) : (
          <Text style={styles.generateButtonText}>
            Generate AI Video
          </Text>
        )}
      </TouchableOpacity>

      {!!statusText && (
        <Text style={styles.status}>
          {statusText}
        </Text>
      )}

      {videoUrl && (
        <TouchableOpacity
          style={styles.videoButton}
          onPress={openVideo}
        >
          <Text style={styles.videoButtonText}>
            ▶ Watch Generated Video
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.info}>
        5 second videos are free. Longer videos
        require Premium.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#101114",
    padding: 20,
    paddingTop: 55,
    alignItems: "center",
  },

  title: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 16,
    color: "#aaaaaa",
    marginBottom: 30,
  },

  photoButton: {
    width: "100%",
    backgroundColor: "#2d6cdf",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },

  photoButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "bold",
  },

  image: {
    width: "100%",
    height: 320,
    backgroundColor: "#1b1d21",
    borderRadius: 14,
    marginBottom: 25,
  },

  label: {
    width: "100%",
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 10,
  },

  promptInput: {
    width: "100%",
    minHeight: 130,
    backgroundColor: "#1b1d21",
    borderWidth: 1,
    borderColor: "#33363d",
    borderRadius: 12,
    padding: 15,
    color: "#ffffff",
    fontSize: 16,
    marginBottom: 20,
  },

  durationRow: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
    marginBottom: 22,
  },

  durationButton: {
    flex: 1,
    backgroundColor: "#1b1d21",
    borderWidth: 1,
    borderColor: "#444851",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  durationButtonActive: {
    backgroundColor: "#7b3ff2",
    borderColor: "#7b3ff2",
  },

  durationText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },

  durationTextActive: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },

  freeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 4,
  },

  premiumText: {
    color: "#f1b84b",
    fontSize: 9,
    fontWeight: "bold",
    marginTop: 4,
  },

  generateButton: {
    width: "100%",
    backgroundColor: "#7b3ff2",
    paddingVertical: 17,
    borderRadius: 12,
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },

  generateButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  loadingText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "bold",
    marginLeft: 10,
  },

  status: {
    color: "#dddddd",
    fontSize: 15,
    textAlign: "center",
    marginTop: 18,
  },

  videoButton: {
    width: "100%",
    backgroundColor: "#208b55",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },

  videoButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "bold",
  },

  info: {
    color: "#888888",
    fontSize: 13,
    textAlign: "center",
    marginTop: 22,
    lineHeight: 19,
  },
});
