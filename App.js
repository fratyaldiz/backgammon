import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
    // Kayıtlı oyun, ayarlar ve istatistikleri yükle
    initApp();
  }, [initApp]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar hidden />
      {gamePhase === 'menu' ? <MenuScreen /> : <GameScreen />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
