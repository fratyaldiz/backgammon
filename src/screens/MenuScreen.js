import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import useGameStore from '../store/gameStore';
import THEME from '../constants/theme';
import {
  TABLES, minBalanceFor, canPlay, bonusStatus,
  formatRemaining, formatCoins, BONUS_AMOUNT
} from '../utils/economy';
import { makeScale, clamp } from '../utils/layout';

const MenuScreen = () => {
  const {
    startGame, tableId, setTable, hasSavedGame, continueGame,
    stats, balance, lastBonusAt, claimBonus, message,
  } = useGameStore();

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(40)).current;

  // Ödül sayacının geri sayması için saniyede bir yenilenir
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, delay: 150, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Cihaza gore oranlama + guvenli alan (centik/ev gostergesi)
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { s: sc } = makeScale(winW, winH);
  const usableW = winW - insets.left - insets.right;
  // Uc masa karti + bosluklar kullanilabilir genisligi asmasin
  const cardGap = sc(10);
  const cardW = clamp((usableW - sc(48) - cardGap * 2) / 3, 96, 190);

  const bonus = bonusStatus(lastBonusAt, now);
  const selected = TABLES.find(t => t.id === tableId) || TABLES[1];
  const affordable = canPlay(balance, selected);

  return (
    <LinearGradient colors={['#1a0e08', '#2A1509', '#0d0704']} style={styles.container}>
      {/* Üst şerit: bakiye ve ödül */}
      <View style={[styles.topBar, { top: insets.top + sc(8), left: insets.left + sc(14), right: insets.right + sc(14) }]}>
        <View style={styles.coinBox}>
          <Ionicons name="cash" size={18} color={THEME.colors.gold} />
          <Text style={styles.coinText}>{formatCoins(balance)}</Text>
        </View>

        {bonus.ready ? (
          <TouchableOpacity style={styles.bonusReady} onPress={claimBonus}>
            <Ionicons name="gift" size={16} color={THEME.colors.textDark} />
            <Text style={styles.bonusReadyText}>+{formatCoins(BONUS_AMOUNT)} ÖDÜL AL</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.bonusWait}>
            <Ionicons name="time-outline" size={14} color={THEME.colors.textSecondary} />
            <Text style={styles.bonusWaitText}>{formatRemaining(bonus.remainingMs)}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sc(46), paddingBottom: insets.bottom + sc(14), paddingHorizontal: Math.max(insets.left, insets.right) + sc(12) }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.titleContainer, { opacity: fadeAnim }]}>
          <Text style={[styles.title, { fontSize: sc(44), letterSpacing: sc(10) }]}>TAVLA</Text>
          <Text style={styles.subtitle}>Backgammon</Text>
        </Animated.View>

        <Animated.View style={[styles.tablesWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.sectionTitle}>Masa Seç</Text>
          <View style={[styles.tableRow, { gap: cardGap }]}>
            {TABLES.map(t => {
              const ok = canPlay(balance, t);
              const isSel = t.id === tableId;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tableCard, { width: cardW }, isSel && styles.tableCardSelected, !ok && styles.tableCardLocked]}
                  onPress={() => setTable(t.id)}
                  disabled={!ok}
                >
                  {!ok && (
                    <View style={styles.lockRow}>
                      <Ionicons name="lock-closed" size={11} color={THEME.colors.textSecondary} />
                      <Text style={styles.lockText}>{formatCoins(minBalanceFor(t))}</Text>
                    </View>
                  )}
                  <Text style={[styles.tableName, isSel && styles.textGold]}>{t.name}</Text>
                  <View style={styles.betRow}>
                    <Ionicons name="cash-outline" size={12} color={ok ? THEME.colors.goldLight : '#6b5636'} />
                    <Text style={[styles.betText, !ok && styles.dimText]}>{formatCoins(t.bet)}</Text>
                  </View>
                  <Text style={[styles.tableDesc, !ok && styles.dimText]}>{t.desc}</Text>
                  <Text style={styles.marsHint}>Mars ×2</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {hasSavedGame && (
            <TouchableOpacity style={[styles.button, { width: clamp(usableW * 0.34, 190, 300) }]} onPress={continueGame}>
              <LinearGradient colors={[THEME.colors.goldLight, THEME.colors.gold]} style={styles.buttonInner}>
                <Text style={[styles.buttonText, styles.buttonTextDark]}>DEVAM ET</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, { width: clamp(usableW * 0.34, 190, 300) }, !affordable && styles.buttonDisabled]}
            onPress={() => startGame(selected.difficulty, selected.id)}
            disabled={!affordable}
          >
            <LinearGradient
              colors={affordable
                ? [THEME.colors.buttonHover, THEME.colors.buttonPrimary]
                : ['#3a2a18', '#2a1e11']}
              style={styles.buttonInner}
            >
              <Text style={styles.buttonText}>
                {hasSavedGame ? 'YENİ OYUN' : 'OYUNA BAŞLA'}
              </Text>
              {affordable && (
                <Text style={styles.buttonSub}>Bahis {formatCoins(selected.bet)}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {!affordable && (
            <Text style={styles.warnText}>
              {bonus.ready
                ? 'Ödülünüzü alın veya daha düşük bir masa seçin.'
                : `Bakiye yetersiz. Ödüle ${formatRemaining(bonus.remainingMs)} kaldı.`}
            </Text>
          )}
          {message ? <Text style={styles.warnText}>{message}</Text> : null}

          {stats.played > 0 && (
            <Text style={styles.statsLine}>
              {stats.played} oyun · {stats.won} galibiyet · {stats.lost} mağlubiyet
              {stats.marsWon > 0 ? ` · ${stats.marsWon} mars` : ''}
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // dolgu guvenli alana gore bilesende veriliyor
  },
  topBar: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  coinBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.gold,
  },
  coinText: {
    color: THEME.colors.goldLight,
    fontSize: 15,
    fontWeight: 'bold',
  },
  bonusReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  bonusReadyText: {
    color: THEME.colors.textDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bonusWait: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  bonusWaitText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  titleContainer: { alignItems: 'center', marginBottom: 18 },
  title: {
    fontWeight: 'bold',
    color: THEME.colors.gold,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
    fontFamily: THEME.fonts.heading,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    letterSpacing: 4,
  },
  tablesWrap: { alignItems: 'center', marginBottom: 18 },
  sectionTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    marginBottom: 10,
    letterSpacing: 1,
  },
  tableRow: { flexDirection: 'row' },
  tableCard: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3a2a18',
    alignItems: 'center',
  },
  tableCardSelected: {
    borderColor: THEME.colors.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  tableCardLocked: { opacity: 0.55 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  lockText: { color: THEME.colors.textSecondary, fontSize: 10 },
  tableName: {
    color: THEME.colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'center',
  },
  textGold: { color: THEME.colors.goldLight },
  betRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  betText: { color: THEME.colors.goldLight, fontSize: 14, fontWeight: 'bold' },
  dimText: { color: '#6b5636' },
  tableDesc: {
    color: THEME.colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
  marsHint: {
    color: THEME.colors.danger,
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  actions: { alignItems: 'center' },
  button: {
    borderRadius: 26,
    overflow: 'hidden',
    marginBottom: 10,
    elevation: 8,
    shadowColor: THEME.colors.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  buttonDisabled: { shadowOpacity: 0 },
  buttonInner: {
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: THEME.colors.textPrimary,
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  buttonTextDark: { color: THEME.colors.textDark },
  buttonSub: {
    color: 'rgba(245,230,211,0.75)',
    fontSize: 10,
    marginTop: 1,
    letterSpacing: 0.5,
  },
  warnText: {
    color: THEME.colors.goldLight,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  statsLine: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    marginTop: 12,
    letterSpacing: 0.5,
  },
});

export default MenuScreen;
