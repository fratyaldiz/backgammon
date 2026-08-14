import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import THEME from '../constants/theme';
import { DICE_SPIN_MS } from '../utils/diceUtils';

const HALF_SPIN = DICE_SPIN_MS / 2;

const Die = ({ value, isUsed, rolling, size = THEME.sizes.diceSize }) => {
  const rotation = React.useRef(new Animated.Value(0)).current;

  // Dönerken gerçek sonuç gizlenir: yüzler hızla değişir, atış bitince
  // asıl değer ortaya çıkar. Aksi halde sonuç animasyon boyunca okunabilir.
  const [face, setFace] = useState(value);

  useEffect(() => {
    if (!rolling) { setFace(value); return; }
    let last = value;
    const id = setInterval(() => {
      // Arka arkaya aynı yüz gelmesin, dönme hissi kaybolmasın
      let next;
      do { next = 1 + Math.floor(Math.random() * 6); } while (next === last);
      last = next;
      setFace(next);
    }, 70);
    return () => clearInterval(id);
  }, [rolling, value]);

  useEffect(() => {
    if (rolling) {
      rotation.setValue(0);
      Animated.sequence([
        Animated.timing(rotation, { toValue: 1, duration: HALF_SPIN, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: 2, duration: HALF_SPIN, easing: Easing.out(Easing.ease), useNativeDriver: true })
      ]).start();
    } else {
      Animated.timing(rotation, { toValue: 0, duration: 100, useNativeDriver: true }).start();
    }
  }, [rolling]);

  const spin = rotation.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['0deg', '360deg', '720deg']
  });

  const animatedStyle = {
    transform: [{ rotate: spin }],
    // Dönerken sönükleştirme yok: kullanılmış zar ipucu vermesin
    opacity: !rolling && isUsed ? 0.3 : 1,
  };
  const dotSize = Math.max(size * 0.19, 4);

  if (!value) return null;

  const dots = [];
  const dotPositions = {
    1: [[0.5, 0.5]],
    2: [[0.2, 0.2], [0.8, 0.8]],
    3: [[0.2, 0.2], [0.5, 0.5], [0.8, 0.8]],
    4: [[0.2, 0.2], [0.2, 0.8], [0.8, 0.2], [0.8, 0.8]],
    5: [[0.2, 0.2], [0.2, 0.8], [0.5, 0.5], [0.8, 0.2], [0.8, 0.8]],
    6: [[0.2, 0.2], [0.2, 0.5], [0.2, 0.8], [0.8, 0.2], [0.8, 0.5], [0.8, 0.8]],
  };

  // Dönerken gösterilen yüz gerçek sonuç değildir
  const currentPositions = dotPositions[rolling ? face : value] || [];

  return (
    <Animated.View style={[styles.die, { width: size, height: size, borderRadius: size * 0.2 }, animatedStyle]}>
      {currentPositions.map((pos, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              left: `${pos[0] * 100}%`,
              top: `${pos[1] * 100}%`,
              transform: [{ translateX: -dotSize / 2 }, { translateY: -dotSize / 2 }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
};

const Dice = ({ dice, rolling, remainingMoves, onRoll, size }) => {
  if (!dice && onRoll) {
    return (
      <TouchableOpacity style={styles.rollButton} onPress={onRoll}>
        <Text style={styles.rollButtonText}>ZAR AT</Text>
      </TouchableOpacity>
    );
  }

  if (!dice) return null;

  let movesCopy = [...(remainingMoves || [])];
  
  const isUsed1 = dice[0] === dice[1] ? movesCopy.length < 4 : !movesCopy.includes(dice[0]);
  if (!isUsed1 && dice[0] !== dice[1]) {
    const idx = movesCopy.indexOf(dice[0]);
    if (idx > -1) movesCopy.splice(idx, 1);
  } else if (!isUsed1 && dice[0] === dice[1]) {
    movesCopy.pop();
  }

  const isUsed2 = dice[0] === dice[1] ? movesCopy.length < 3 : !movesCopy.includes(dice[1]);

  return (
    <View style={styles.container}>
      <Die value={dice[0]} isUsed={isUsed1} rolling={rolling} size={size} />
      <Die value={dice[1]} isUsed={isUsed2} rolling={rolling} size={size} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  die: {
    backgroundColor: THEME.colors.diceWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    backgroundColor: THEME.colors.diceDots,
  },
  rollButton: {
    backgroundColor: THEME.colors.buttonPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: THEME.colors.gold,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    elevation: 3,
  },
  rollButtonText: {
    color: THEME.colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
});

export default Dice;
export { Die };
