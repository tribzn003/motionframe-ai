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
        setProgress("");
      }
    } catch (error) {
      Alert.alert(
        "Photo error",
        String(error?.message || error)
      );
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
      Alert.alert(
        "Choose a photo",
        "Choose a photo first."
      );
      return;
    }

    setBusy(true);
    setVideoUrl("");
    setProgress("Creating video...");

    try {
      const inputPath = asset.uri.replace("file://", "");

      const slash = inputPath.lastIndexOf("/");
      const directory =
        slash >= 0
          ? inputPath.substring(0, slash + 1)
          : "";

      const outputPath =
        directory + `motionframe_${Date.now()}.mp4`;

      const result = await execute(
        [
          "-y",
          "-loop",
          "1",
          "-i",
          inputPath,
          "-vf",
          getFilter(),
          "-t",
          String(duration),
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          outputPath,
        ],
        undefined,
        (
          timeMs,
          sizeBytes,
          bitrateKbits,
          speed,
          frame
        ) => {
          if (frame) {
            const total = duration * 30;

            const percent = Math.min(
              100,
              Math.round((frame / total) * 100)
            );

            setProgress(
              `Creating video... ${percent}%`
            );
          }
        }
      );

      if (!result.success) {
        throw new Error(
          result.failStackTrace ||
            result.output ||
            "Video creation failed."
        );
      }

      setVideoUrl(`file://${outputPath}`);
      setProgress("Done");
    } catch (error) {
      console.log(error);
      setProgress("");

      Alert.alert(
        "Video error",
        String(error?.message || error)
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
            fontSize: 15,
            marginTop: 6,
          }}
        >
          Create unlimited photo motion videos.
        </Text>

        <Button
          title={
            asset
              ? "Choose another photo"
              : "Choose photo"
          }
          onPress={pickImage}
          disabled={busy}
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
            color: "#fff",
            fontWeight: "800",
            fontSize: 18,
            marginTop: 22,
          }}
        >
          Motion
        </Text>

        <Button
          title="Zoom In"
          selected={motion === "zoom"}
          onPress={() => setMotion("zoom")}
          disabled={busy}
        />

        <Button
          title="Zoom Out"
          selected={motion === "out"}
          onPress={() => setMotion("out")}
          disabled={busy}
        />

        <Button
          title="Camera Pan"
          selected={motion === "pan"}
          onPress={() => setMotion("pan")}
          disabled={busy}
        />

        <Text
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: 18,
            marginTop: 22,
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
              selected={duration === 5}
              onPress={() => setDuration(5)}
              disabled={busy}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Button
              title="10 sec"
              selected={duration === 10}
              onPress={() => setDuration(10)}
              disabled={busy}
            />
          </View>
        </View>

        <Button
          title="Create video"
          onPress={createVideo}
          disabled={!asset || busy}
        />

        {busy && (
          <View
            style={{
              alignItems: "center",
              marginTop: 22,
            }}
          >
            <ActivityIndicator size="large" />

            <Text
              style={{
                color: "#aaa",
                marginTop: 10,
              }}
            >
              {progress}
            </Text>
          </View>
        )}

        {videoUrl ? (
          <>
            <Text
              style={{
                color: "#fff",
                fontWeight: "800",
                fontSize: 18,
                marginTop: 26,
              }}
            >
              Your video
            </Text>

            <ResultVideo
              key={videoUrl}
              url={videoUrl}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
