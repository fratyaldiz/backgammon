import React, { useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import useGameStore from './src/store/gameStore';
import MenuScreen from './src/screens/MenuScreen';
import GameScreen from './src/screens/GameScreen';

export default function App() {
  const gamePhase = useGameStore((state) => state.gamePhase);
  const initApp = useGameStore((state) => state.initApp);

  useEffect(() => {
    async function lockOrientation() {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
    lockOrientation();

    // Android'de gezinme çubuğu yatay modda ekrandan yer çalıyor; tam ekran
    // (immersive) moduna alınır, kenardan kaydırınca geçici olarak görünür.
    // Desteklenmeyen sürümlerde sessizce atlanır.
    if (Platform.OS === 'android') {
      (async () => {
        try {
          const NavigationBar = await import('expo-navigation-bar');
          await NavigationBar.setVisibilityAsync('hidden');
          await NavigationBar.setBehaviorAsync('overlay-swipe');
        } catch (e) {
          // gezinme çubuğu gizlenemezse oyun normal çalışmaya devam eder
        }
      })();
    }

    // Kayıtlı oyun, ayarlar ve istatistikleri yükle
    initApp();
  }, [initApp]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.container}>
        <StatusBar hidden />
        {gamePhase === 'menu' ? <MenuScreen /> : <GameScreen />}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
