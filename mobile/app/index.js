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

const API_URL = "https://ewr.onrender.com";

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

        setImageType(
          asset.mimeType || "image/jpeg"
        );

        setImageName(
          asset.fileName || "photo.jpg"
        );

        setVideoUrl(null);
        setStatusText("");
      }
    } catch (error) {
      console.log(error);

      Alert.alert
