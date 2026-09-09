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
            task.failureCode ||
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
      formData.append("duration", String(duration));

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

      setStatusText(
        `Creating ${duration} second video...`
      );

      const finishedVideoUrl =
        await checkTaskUntilFinished(
          result.task_id
        );

      setVideoUrl(finishedVideoUrl);
      setStatusText("Video is ready!");

      Alert.alert(
        "Video ready",
        `Your ${duration} second AI video has been generated.`
      );
    } catch (error) {
      setStatusText("");

      Alert.alert(
