import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import { useVideoPlayer, VideoView } from "expo-video";

const backendUrl = Constants.expoConfig?.extra?.backendUrl;

function Button({ title, onPress, disabled, secondary }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingVertical: 15,
        paddingHorizontal: 18,
        borderRadius: 14,
        marginTop: 12,
        backgroundColor: disabled ? "#555" : secondary ? "#232323" : "#fff",
        borderWidth: secondary ? 1 : 0,
        borderColor: "#444",
      }}
    >
      <Text
        style={{
          textAlign: "center",
          fontWeight: "800",
          color: secondary ? "#fff" : "#111",
          fontSize: 16,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function ResultVideo({ url }) {
  const player = useVideoPlayer(url, p => {
    p.loop = true;
  });

  return (
    <VideoView
      player={player}
      style={{
        width: "100%",
        aspectRatio: 16 / 9,
        borderRadius: 18,
        marginTop: 18,
      }}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
}

export default function Home() {
  const [asset, setAsset] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const canGenerate = useMemo(
    () => !!asset && !!prompt.trim() && !busy,
    [asset, prompt, busy]
  );

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsEditing: false,
    });

    if (!result.canceled) {
      setAsset(result.assets[0]);
      setVideoUrl("");
      setStatus("");
    }
  }

  async function pollTask(taskId) {
    for (let i = 0; i < 180; i++) {
      await new Promise(r => setTimeout(r, 3000));

      const r = await fetch(`${backendUrl}/tasks/${taskId}`);
      const data = await r.json();

      if (!r.ok) {
        throw new Error(data?.detail || "Could not read task status.");
      }

      const s = (data.status || "").toUpperCase();
      setStatus(s || "PROCESSING");

      if (s === "SUCCEEDED") {
        const url = data.output?.[0];

        if (!url) {
          throw new Error("Generation completed without a video URL.");
        }

        setVideoUrl(url);
        return;
      }

      if (s === "FAILED" || s === "CANCELED") {
        throw new Error(
          data.failure || `Generation ${s.toLowerCase()}.`
        );
      }
    }

    throw new Error("Generation is taking longer than expected.");
  }

  async function generate() {
    if (!backendUrl || backendUrl.includes("YOUR-BACKEND")) {
      Alert.alert(
        "Backend not configured",
        "Set the backend URL in app.json first."
      );
      return;
    }

    setBusy(true);
    setVideoUrl("");
    setStatus("UPLOADING");

    try {
      const form = new FormData();

      form.append("prompt", prompt.trim());
      form.append("duration", String(duration));

      form.append("image", {
        uri: asset.uri,
        name: asset.fileName || "input.jpg",
        type: asset.mimeType || "image/jpeg",
      });

      const r = await fetch(`${backendUrl}/generate`, {
        method: "POST",
        body: form,
      });

      const data = await r.json();

      if (!r.ok) {
        throw new Error(data?.detail || "Could not start generation.");
      }

      if (!data.task_id) {
        throw new Error("Backend returned no task ID.");
      }

      setStatus("PENDING");

      await pollTask(data.task_id);

    } catch (e) {
      setStatus("ERROR");

      Alert.alert(
        "Generation error",
        String(e?.message || e)
      );

    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#0b0b0b",
      }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 60,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 30,
            fontWeight: "900",
            marginTop: 10,
          }}
        >
          MotionFrame AI
        </Text>

        <Text
          style={{
            color: "#aaa",
            marginTop: 6,
            fontSize: 15,
          }}
        >
          Turn a photo into an AI video.
        </Text>

        <Button
          title={
            asset
              ? "Choose another photo"
              : "Choose photo"
          }
          onPress={pickImage}
        />

        {asset && (
          <Image
            source={{ uri: asset.uri }}
            style={{
              width: "100%",
              aspectRatio: 1,
              borderRadius: 18,
              marginTop: 16,
            }}
            resizeMode="cover"
          />
        )}

        <Text
          style={{
            color: "#ddd",
            fontWeight: "700",
            marginTop: 20,
            marginBottom: 8,
          }}
        >
          Describe the motion
        </Text>

        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Example: Natural movement, cinematic camera motion..."
          placeholderTextColor="#666"
          multiline
          style={{
            minHeight: 120,
            borderRadius: 16,
            backgroundColor: "#171717",
            color: "#fff",
            padding: 15,
            textAlignVertical: "top",
            fontSize: 16,
            borderWidth: 1,
            borderColor: "#333",
          }}
        />

        <Text
          style={{
            color: "#ddd",
            fontWeight: "700",
            marginTop: 18,
          }}
        >
          Duration
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button
              title="5 sec"
              secondary={duration !== 5}
              onPress={() => setDuration(5)}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Button
              title="10 sec"
              secondary={duration !== 10}
              onPress={() => setDuration(10)}
            />
          </View>
        </View>

        <Button
          title="Generate video"
          onPress={generate}
          disabled={!canGenerate}
        />

        {busy && (
          <View
            style={{
              alignItems: "center",
              marginTop: 22,
            }}
          >
            <ActivityIndicator />

            <Text
              style={{
                color: "#aaa",
                marginTop: 10,
              }}
            >
              {status || "PROCESSING"}
            </Text>
          </View>
        )}

        {videoUrl ? (
          <>
            <Text
              style={{
                color: "#fff",
                fontWeight: "800",
                marginTop: 24,
                fontSize: 18,
              }}
            >
              Your video
            </Text>

            <ResultVideo url={videoUrl} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
