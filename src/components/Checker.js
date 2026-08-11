import React, { useEffect } from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import THEME from '../constants/theme';
import { WHITE } from '../utils/diceUtils';
import { LinearGradient } from 'expo-linear-gradient';

const Checker = ({ color, isSelected, count, size = 32 }) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  const glowOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSelected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.1, duration: 500, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 500, useNativeDriver: true })
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.4, duration: 500, useNativeDriver: true })
        ])
      ).start();
    } else {
      scale.stopAnimation();
      glowOpacity.stopAnimation();
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(glowOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [isSelected]);

  const animatedStyle = { transform: [{ scale }] };
  const glowStyle = { opacity: glowOpacity };

  const isWhite = color === WHITE;
  
  // Profesyonel 3D gradient renkleri
  const gradientColors = isWhite 
    ? ['#FFFFFF', '#F0E6D2', '#D8C3A5']
    : ['#4A4A4A', '#2C2C2C', '#111111'];

  const innerGradientColors = isWhite
    ? ['#D8C3A5', '#F0E6D2', '#FFFFFF']
    : ['#111111', '#2C2C2C', '#4A4A4A'];

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, animatedStyle]}>
      <Animated.View style={[
        styles.glow, 
        { 
          backgroundColor: isWhite ? THEME.colors.checkerWhiteGlow : THEME.colors.checkerBlackGlow,
          width: size * 1.3,
          height: size * 1.3,
          borderRadius: size * 0.65
        },
        glowStyle
      ]} />
      <LinearGradient
        colors={gradientColors}
        style={[
          styles.checker,
          { 
            borderColor: isWhite ? '#C0B298' : '#000000',
            borderRadius: size / 2
          }
        ]}
      >
        <LinearGradient
          colors={innerGradientColors}
          style={[styles.innerRing, { borderRadius: size * 0.35 }]}
        >
          <View style={[styles.centerDimple, { borderRadius: size * 0.2 }]} />
        </LinearGradient>
        {count && <Text style={[styles.countText, { color: isWhite ? '#000' : '#FFF', fontSize: size * 0.4 }]}>{count}</Text>}
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  checker: {
    width: '95%',
    height: '95%',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 6,
  },
  innerRing: {
    width: '70%',
    height: '70%',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerDimple: {
    width: '40%',
    height: '40%',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glow: {
    position: 'absolute',
  },
  countText: {
    position: 'absolute',
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default Checker;
