import React, { useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import THEME from '../constants/theme';

const Die = ({ value, isUsed, rolling }) => {
  const rotation = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (rolling) {
      rotation.setValue(0);
      Animated.sequence([
        Animated.timing(rotation, { toValue: 1, duration: 400, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: 2, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true })
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
    opacity: isUsed ? 0.3 : 1,
  };

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

  const currentPositions = dotPositions[value] || [];

  return (
    <Animated.View style={[styles.die, animatedStyle]}>
      {currentPositions.map((pos, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              left: `${pos[0] * 100}%`,
              top: `${pos[1] * 100}%`,
              transform: [{ translateX: -4 }, { translateY: -4 }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
};

const Dice = ({ dice, rolling, remainingMoves, onRoll }) => {
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
      <Die value={dice[0]} isUsed={isUsed1} rolling={rolling} />
      <Die value={dice[1]} isUsed={isUsed2} rolling={rolling} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 15,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  die: {
    width: THEME.sizes.diceSize,
    height: THEME.sizes.diceSize,
    backgroundColor: THEME.colors.diceWhite,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: THEME.colors.diceDots,
    borderRadius: 4,
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
