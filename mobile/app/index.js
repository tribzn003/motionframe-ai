import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import { execute } from "munim-ffmpeg";
import { useVideoPlayer, VideoView } from "expo-video";

function Button({ title, onPress, disabled, selected }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderRadius: 14,
        marginTop: 12,
        backgroundColor: disabled
          ? "#444"
          : selected
          ? "#ffffff"
          : "#202020",
        borderWidth: 1,
        borderColor: selected ? "#ffffff" : "#444",
      }}
    >
      <Text
        style={{
          textAlign: "center",
          fontWeight: "800",
          fontSize: 16,
          color: selected ? "#111" : "#fff",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function ResultVideo({ url }) {
  const player = useVideoPlayer(url, (player) => {
    player.loop = true;
    player.play();
  });

  return (
    <VideoView
      player={player}
      style={{
        width: "100%",
        aspectRatio: 16 / 9,
        borderRadius: 18,
        marginTop: 16,
      }}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
}

export default function Home() {
  const [asset, setAsset] = useState(null);
  const [duration, setDuration] = useState(5);
  const [motion, setMotion] = useState("zoom");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled) {
        setAsset(result.assets[0]);
        setVideoUrl("");
      }
    } catch (error) {
      Alert.alert("Photo error", String(error?.message || error));
    }
  }

  function getFilter() {
    const frames = duration * 30;

    if (motion === "out") {
      return (
        "scale=1400:800:force_original_aspect_ratio=increase," +
        "crop=1280:720," +
        `zoompan=z='if(eq(on,1),1.15,max(zoom-0.001,1.0))':` +
        `d=${frames}:s=1280x720:fps=30`
      );
    }

    if (motion === "pan") {
      return (
        "scale=1500:850:force_original_aspect_ratio=increase," +
        `zoompan=z='1.08':x='(iw-iw/zoom)*on/${frames}':` +
        `y='(ih-ih/zoom)/2':d=${frames}:s=1280x720:fps=30`
      );
    }

    return (
      "scale=1400:800:force_original_aspect_ratio=increase," +
      "crop=1280:720," +
      `zoompan=z='min(zoom+0.001,1.15)':` +
      `d=${frames}:s=1280x720:fps=30`
    );
  }

  async function createVideo() {
    if (!asset?.uri) {
      Alert.alert("Choose a photo", "Choose
