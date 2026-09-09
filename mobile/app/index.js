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
} from "react-native";

import * as ImagePicker from "expo-image-picker";

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState(null);
  const [prompt, setPrompt] = useState("");
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
      }
    } catch (error) {
      console.log(error);

      Alert.alert(
        "Error",
        "Could not select the photo."
      );
    }
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

    try {
      /*
        NEXT
