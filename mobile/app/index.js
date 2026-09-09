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
      Alert.alert("Error", "Could not select the photo.");
    }
  };

  const checkService = async () => {
    const response = await fetch(`${API_URL}/status`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error("Could not connect to MotionFrame AI.");
    }

    return result;
  };

  const checkTaskUntilFinished = async (taskId) => {
    for (let attempt = 0; attempt < 120; attempt++) {
      setStatusText("AI is creating your video...");

      const response = await fetch(
        `${API_URL}/tasks/${taskId}`
      );

      const task = await response.json();

      if (!response.ok) {
