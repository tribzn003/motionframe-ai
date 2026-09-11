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

const API_URL =
  "https://motionframe-ai.onrender.com";

const sleep = (ms) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

export default function HomeScreen() {
  const [apiKey, setApiKey] = useState("");
  const [imageUri, setImageUri] =
    useState(null);
  const [imageType, setImageType] =
    useState("image/jpeg");
  const [imageName, setImageName] =
    useState("photo.jpg");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] =
    useState(10);
  const [creating, setCreating] =
    useState(false);
  const [statusText, setStatusText] =
    useState("");
  const [videoUrl, setVideoUrl] =
    useState(null);

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Потребна дозвола",
          "Дозволите приступ фотографијама."
        );
        return;
      }

      const result =
        await ImagePicker
          .launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: false,
            quality: 1,
          });

      if (
        !result.canceled &&
        result.assets?.length > 0
      ) {
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
      Alert.alert(
        "Грешка",
        "Фотографија није могла да се изабере."
      );
    }
  };

  const checkService = async () => {
    const response = await fetch(
      `${API_URL}/status`
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.detail ||
          "Није могуће повезивање са сервером."
      );
    }

    return result;
  };

  const checkTaskUntilFinished = async (
    taskId
  ) => {
    for (
      let attempt = 0;
      attempt < 240;
      attempt++
    ) {
      setStatusText(
        "AI прави видео. Молимо сачекајте..."
      );

      const response = await fetch(
        `${API_URL}/tasks/${taskId}`
      );

      const task = await response.json();

      if (!response.ok) {
        throw new Error(
          task?.detail ||
            "Статус видеа није доступан."
        );
      }

      const normalizedStatus = String(
        task?.status || ""
      ).toLowerCase();

      if (
        normalizedStatus === "succeeded"
      ) {
        if (
          Array.isArray(task.output) &&
          task.output.length > 0
        ) {
          return task.output[0];
        }

        throw new Error(
          "Видео је завршен, али линк није враћен."
        );
      }

      if (
        normalizedStatus === "failed" ||
        normalizedStatus === "cancelled" ||
        normalizedStatus === "canceled"
      ) {
        throw new Error(
          task.failure ||
            "Генерисање видеа није успело."
        );
      }

      await sleep(5000);
    }

    throw new Error(
      "Генерисање траје предуго."
    );
  };

  const generateVideo = async () => {
    if (!apiKey.trim()) {
      Alert.alert(
        "Недостаје API кључ",
        "Унесите свој Wavespeed API кључ."
      );
      return;
    }

    if (!imageUri) {
      Alert.alert(
        "Изаберите фотографију",
        "Прво изаберите фотографију."
      );
      return;
    }

    if (!prompt.trim()) {
      Alert.alert(
        "Унесите опис",
        "Напишите шта желите да се дешава."
      );
      return;
    }

    if (![10, 15, 30].includes(duration)) {
      Alert.alert(
        "Погрешна дужина",
        "Изаберите 10, 15 или 30 секунди."
      );
      return;
    }

    setCreating(true);
    setVideoUrl(null);
    setStatusText("Провера AI сервера...");

    try {
      await checkService();

      setStatusText(
        "Отпремање фотографије..."
      );

      const formData = new FormData();

      formData.append("image", {
        uri: imageUri,
        name: imageName,
        type: imageType,
      });

      formData.append(
        "prompt",
        prompt.trim()
      );

      formData.append(
        "duration",
        String(duration)
      );

      formData.append(
        "api_key",
        apiKey.trim()
      );

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
            : "Генерисање није покренуто."
        );
      }

      if (!result.task_id) {
        throw new Error(
          "Сервер није вратио број задатка."
        );
      }

      setStatusText(
        `Прављење видеа од ${duration} секунди...`
      );

      const finishedVideoUrl =
        await checkTaskUntilFinished(
          result.task_id
        );

      setVideoUrl(finishedVideoUrl);
      setStatusText("Видео је спреман!");

      Alert.alert(
        "Видео је спреман",
        "Притисните дугме за гледање."
      );
    } catch (error) {
      setStatusText("");

      Alert.alert(
        "Грешка",
        error?.message ||
          "Није могуће повезивање са сервером."
      );
    } finally {
      setCreating(false);
    }
  };

  const openVideo = async () => {
    if (!videoUrl) {
      return;
    }

    try {
      await Linking.openURL(videoUrl);
    } catch (error) {
      Alert.alert(
        "Грешка",
        "Видео није могуће отворити."
      );
    }
  };

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        MotionFrame AI
      </Text>

      <Text style={styles.subtitle}>
        Претворите фотографију у AI видео
      </Text>

      <Text style={styles.label}>
        Ваш Wavespeed API кључ
      </Text>

      <TextInput
        style={styles.apiInput}
        placeholder="Унесите API кључ"
        placeholderTextColor="#888888"
        value={apiKey}
        onChangeText={setApiKey}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!creating}
      />

      <Text style={styles.keyInfo}>
        Кључ се користи само за вашу
        генерацију и не приказује се другим
        корисницима.
      </Text>

      <TouchableOpacity
        style={styles.photoButton}
        onPress={pickImage}
        disabled={creating}
      >
        <Text style={styles.photoButtonText}>
          Изабери фотографију
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
        Опишите шта желите да се дешава
      </Text>

      <TextInput
        style={styles.promptInput}
        placeholder="На пример: Особа се осмехује и полако хода..."
        placeholderTextColor="#888888"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        textAlignVertical="top"
        editable={!creating}
      />

      <Text style={styles.label}>
        Дужина видеа
      </Text>

      <View style={styles.durationRow}>
        {[10, 15, 30].map((seconds) => {
          const active =
            duration === seconds;

          return (
            <TouchableOpacity
              key={seconds}
              style={[
                styles.durationButton,
                active &&
                  styles.durationButtonActive,
              ]}
              onPress={() =>
                setDuration(seconds)
              }
              disabled={creating}
            >
              <Text
                style={[
                  styles.durationText,
                  active &&
                    styles.durationTextActive,
                ]}
              >
                {seconds} s
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.generateButton,
          creating &&
            styles.disabledButton,
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
              Процесује видео...
            </Text>
          </View>
        ) : (
          <Text
            style={
              styles.generateButtonText
            }
          >
            Генериши видео
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
          <Text
            style={styles.videoButtonText}
          >
            ▶ Погледај направљени видео
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.info}>
        Трошак генерације наплаћује
        Wavespeed са корисничког налога.
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

  label: {
    width: "100%",
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 10,
  },

  apiInput: {
    width: "100%",
    backgroundColor: "#1b1d21",
    borderWidth: 1,
    borderColor: "#444851",
    borderRadius: 12,
    padding: 15,
    color: "#ffffff",
    fontSize: 16,
    marginBottom: 8,
  },

  keyInfo: {
    width: "100%",
    color: "#888888",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
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
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
  },

  durationButtonActive: {
    backgroundColor: "#7b3ff2",
    borderColor: "#7b3ff2",
  },

  durationText: {
    color: "#aaaaaa",
    fontSize: 18,
    fontWeight: "bold",
  },

  durationTextActive: {
    color: "#ffffff",
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
