import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useGameStore from '../store/gameStore';
import THEME from '../constants/theme';

const MenuScreen = () => {
  const { startGame, difficulty, setDifficulty, hasSavedGame, continueGame, stats } = useGameStore();
  const [selectedDiff, setSelectedDiff] = useState(difficulty);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, delay: 300, useNativeDriver: true })
    ]).start();
  }, []);

  const handleStart = () => {
    setDifficulty(selectedDiff);
    startGame(selectedDiff);
  };

  const difficulties = [
    { id: 'easy', name: 'Kolay', desc: 'Rastgele hamleler' },
    { id: 'medium', name: 'Orta', desc: 'Temel strateji' },
    { id: 'hard', name: 'Uzman', desc: 'Konum analizi + ileri hamle hesabı' }
  ];

  return (
    <LinearGradient colors={['#1a0e08', '#2A1509', '#0d0704']} style={styles.container}>
      <Animated.View style={[styles.titleContainer, { opacity: fadeAnim }]}>
        <Text style={styles.title}>TAVLA</Text>
        <Text style={styles.subtitle}>Backgammon</Text>
      </Animated.View>

      <Animated.View style={[styles.difficultyContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.difficultyTitle}>Zorluk Seviyesi</Text>
        <View style={styles.difficultyRow}>
          {difficulties.map(diff => (
            <TouchableOpacity
              key={diff.id}
              style={[
                styles.diffCard,
                selectedDiff === diff.id && styles.diffCardSelected
              ]}
              onPress={() => setSelectedDiff(diff.id)}
            >
              <Text style={[styles.diffName, selectedDiff === diff.id && styles.textGold]}>{diff.name}</Text>
              <Text style={styles.diffDesc}>{diff.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
        {hasSavedGame && (
          <TouchableOpacity style={[styles.startButton, styles.continueButton]} onPress={continueGame}>
            <LinearGradient
              colors={[THEME.colors.goldLight, THEME.colors.gold]}
              style={styles.startButtonGradient}
            >
              <Text style={[styles.startButtonText, styles.continueButtonText]}>DEVAM ET</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <LinearGradient
            colors={[THEME.colors.buttonHover, THEME.colors.buttonPrimary]}
            style={styles.startButtonGradient}
          >
            <Text style={styles.startButtonText}>
              {hasSavedGame ? 'YENİ OYUN' : 'OYUNA BAŞLA'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {stats.played > 0 && (
          <Text style={styles.statsLine}>
            {stats.played} oyun · {stats.won} galibiyet · {stats.lost} mağlubiyet
            {stats.marsWon > 0 ? ` · ${stats.marsWon} mars` : ''}
          </Text>
        )}
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 64,
    fontWeight: 'bold',
    color: THEME.colors.gold,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
    letterSpacing: 10,
    fontFamily: THEME.fonts.heading,
  },
  subtitle: {
    fontSize: 20,
    color: THEME.colors.textSecondary,
    letterSpacing: 4,
  },
  difficultyContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  difficultyTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 18,
    marginBottom: 15,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 15,
  },
  diffCard: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#333',
    width: 120,
    alignItems: 'center',
  },
  diffCardSelected: {
    borderColor: THEME.colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  diffName: {
    color: THEME.colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 5,
  },
  textGold: {
    color: THEME.colors.goldLight,
  },
  diffDesc: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  startButton: {
    width: 250,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: THEME.colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  startButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonText: {
    color: THEME.colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  continueButton: {
    marginBottom: 14,
    shadowOpacity: 0.6,
  },
  continueButtonText: {
    color: THEME.colors.textDark,
  },
  statsLine: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    marginTop: 16,
    letterSpacing: 0.5,
  },
});

export default MenuScreen;
