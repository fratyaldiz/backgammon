import React, { useEffect } from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import THEME from '../constants/theme';
import { WHITE } from '../utils/diceUtils';
import { LinearGradient } from 'expo-linear-gradient';

const Checker = ({ color, isSelected, count }) => {
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
  
  const gradientColors = isWhite 
    ? ['#FFF', THEME.colors.checkerWhite, '#D4C4B0']
    : ['#3A3A4E', THEME.colors.checkerBlack, '#0F0F1A'];

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Animated.View style={[
        styles.glow, 
        { backgroundColor: isWhite ? THEME.colors.checkerWhiteGlow : THEME.colors.checkerBlackGlow },
        glowStyle
      ]} />
      <LinearGradient
        colors={gradientColors}
        style={[
          styles.checker,
          { borderColor: isWhite ? THEME.colors.checkerWhiteBorder : THEME.colors.checkerBlackBorder }
        ]}
      >
        <View style={styles.innerRing} />
        {count && <Text style={[styles.countText, { color: isWhite ? '#000' : '#FFF' }]}>{count}</Text>}
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: THEME.sizes.checkerRadius * 2,
    height: THEME.sizes.checkerRadius * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checker: {
    width: '100%',
    height: '100%',
    borderRadius: THEME.sizes.checkerRadius,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 4,
  },
  innerRing: {
    width: '60%',
    height: '60%',
    borderRadius: THEME.sizes.checkerRadius * 0.6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  glow: {
    position: 'absolute',
    width: '120%',
    height: '120%',
    borderRadius: THEME.sizes.checkerRadius * 1.2,
  },
  countText: {
    position: 'absolute',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

export default Checker;
