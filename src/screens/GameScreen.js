import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import useGameStore from '../store/gameStore';
import Board from '../components/Board';
import THEME from '../constants/theme';
import { WHITE, BLACK } from '../utils/diceUtils';
import { getPipCount } from '../utils/gameLogic';
import { getTable, formatCoins, canOfferRaise, nextMultiplier, balanceForRaise } from '../utils/economy';
import { makeScale, clamp } from '../utils/layout';
import { Ionicons } from '@expo/vector-icons';

/**
 * Sayı eski değerden yenisine doğru hızla sayar. Bakiye anında zıplamak
 * yerine sayıldığında kazanç hissi belirginleşir.
 */
const CountUp = ({ from, to, duration = 700, style }) => {
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (from === to) { setValue(to); return; }
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min((Date.now() - start) / duration, 1);
      // Sona doğru yavaşlar
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (p >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [from, to, duration]);

  return <Text style={style}>{formatCoins(value)}</Text>;
};

/**
 * Kompakt oyuncu kartı. Yatay ekranda dikey alan kıymetli olduğu için
 * avatar ve ad tek satırda; kart geniş ve alçak tutulur, kalan alan
 * tahtaya bırakılır.
 */
const PlayerInfo = ({ name, color, isActive, pips, borneOff, avatarSize, font }) => {
  const isWhite = color === WHITE;
  return (
    <LinearGradient
      colors={isActive ? THEME.gradients.panelActive : THEME.gradients.panel}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.playerInfo, isActive && styles.activePlayer]}
    >
      {isActive && (
        <View style={styles.turnBadge}>
          <Text style={[styles.turnBadgeText, { fontSize: font.badge }]}>SIRA</Text>
        </View>
      )}

      <View style={styles.identityRow}>
        <View style={[
          styles.avatar,
          {
            width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
            backgroundColor: isWhite ? '#F0E6D2' : '#1A1A2E',
            borderColor: isActive ? THEME.colors.gold : '#555',
          },
        ]}>
          <Ionicons name="person" size={avatarSize * 0.55} color={isWhite ? '#1A1A2E' : '#F0E6D2'} />
        </View>
        <Text style={[styles.playerName, { fontSize: font.name }]} numberOfLines={1}>{name}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { fontSize: font.label }]}>Pip</Text>
          <Text style={[styles.statValue, { fontSize: font.value }]}>{pips}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { fontSize: font.label }]}>Toplanan</Text>
          <Text style={[styles.statValue, { fontSize: font.value }]}>{borneOff}/15</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const GameScreen = () => {
  const { 
    board, bar, currentPlayer, playerColor, gamePhase, dice, remainingMoves, rollDice, 
    borneOff, message, winner, goToMenu, resetGame,
    turnFinished, moveHistory, undoMove, endTurn,
    pauseGame, resumeGame, isPaused,
    openingDice, openingRolling, rollOpeningDice,
    winType, winPoints, stats, settings, toggleHaptics, toggleSound,
    balance, stake, lastPayout, tableId,
    resignGame, multiplier, cubeOwner, raiseOffer, raiseNotice,
    offerRaise, respondToRaise
  } = useGameStore();

  const isOpeningRoll = gamePhase === 'opening_roll';
  const table = getTable(tableId);

  // Bahis kaybettiren eylemler önce onay ister: 'newGame' | 'resign'
  const [confirmAction, setConfirmAction] = useState(null);
  const inProgress = gamePhase !== 'menu' && gamePhase !== 'game_over' && stake > 0;
  // Katlama önerilebilir mi: hak bizde (veya ortada) ve mars riskini karşılıyoruz
  const canRaise = canOfferRaise(multiplier, cubeOwner, playerColor, tableId)
    && balance >= balanceForRaise(stake, multiplier);

  // Yerleşim ölçüleri cihaza göre oranlanır; çentik/ev göstergesi payları
  // güvenli alandan alınır, böylece hiçbir cihazda içerik kırpılmaz.
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { s } = makeScale(winW, winH);
  const usableW = winW - insets.left - insets.right;
  // Kenar çubukları dar tutulur: kalan genişlik tahtaya gider. Alt sınır
  // "Toplanan 15/15" satırının sığacağı en küçük genişliktir.
  const sidebarW = clamp(usableW * 0.105, 78, 118);
  const avatarSize = clamp(sidebarW * 0.30, 20, 32);
  const font = {
    name: clamp(sidebarW * 0.105, 8, 12),
    label: clamp(sidebarW * 0.085, 7, 10),
    value: clamp(sidebarW * 0.10, 8, 12),
    // "SIRA" rozeti: okunur olsun ama kartı bastırmasın
    badge: clamp(sidebarW * 0.115, 9.5, 13),
  };
  // Zar ve buton ölçüleri de ekranla birlikte oranlanır
  const labelFont = clamp(winH * 0.024, 8, 12);
  const iconSize = clamp(winH * 0.055, 18, 28);
  const btnFont = clamp(winH * 0.026, 9, 13);

  const opponentColor = playerColor === WHITE ? BLACK : WHITE;

  const playerPips = getPipCount(board, bar, playerColor);
  const opponentPips = getPipCount(board, bar, opponentColor);

  const playerBorneOff = playerColor === WHITE ? borneOff.white : borneOff.black;
  const opponentBorneOff = opponentColor === WHITE ? borneOff.white : borneOff.black;

  const playerName = playerColor === WHITE ? 'Siz (Beyaz)' : 'Siz (Siyah)';
  const isPlayerTurn = currentPlayer === playerColor;

  return (
    <View style={[styles.container, { paddingLeft: insets.left + s(5), paddingRight: insets.right + s(5), paddingTop: insets.top + s(4), paddingBottom: insets.bottom + s(4) }]}>
      {/* Sol Kenar - Oyuncu Bilgileri */}
      <View style={[styles.sidebar, { width: sidebarW }]}>
        <PlayerInfo 
          name={playerName}
          color={playerColor}
          isActive={isPlayerTurn}
          pips={playerPips}
          borneOff={playerBorneOff}
          avatarSize={avatarSize}
          font={font}
        />
        {message ? <Text style={[styles.messageText, { fontSize: font.label * 1.15 }]}>{message}</Text> : null}
        {raiseNotice ? (
          <Text style={[styles.raiseNotice, { fontSize: font.label * 1.1 }]}>{raiseNotice}</Text>
        ) : null}
      </View>

      {/* Orta Alan - Tahta */}
      <View style={styles.boardWrapper}>
        <Board />
        
        {/* SAĞ — aksiyon butonları (zarlar tahtanın üstünde) */}
        <View style={styles.actionOverlay}>
          {isOpeningRoll && openingDice.player === null && !openingRolling && (
            <TouchableOpacity style={[styles.rollButton, { minWidth: clamp(winH * 0.17, 60, 96), paddingVertical: s(9) }]} onPress={rollOpeningDice}>
              <Ionicons name="dice" size={iconSize} color={THEME.colors.textDark} />
              <Text style={[styles.rollButtonLabel, { fontSize: btnFont }]}>ZAR AT</Text>
            </TouchableOpacity>
          )}

          {isPlayerTurn && gamePhase === 'rolling' && (
            <View style={styles.rollRow}>
              {/* Katlama, zar atma düğmesinin solunda durur */}
              {canRaise && (
                <TouchableOpacity
                  style={[styles.raiseButton, { minWidth: clamp(winH * 0.15, 52, 84), paddingVertical: s(7) }]}
                  onPress={offerRaise}
                >
                  <Ionicons name="trending-up" size={iconSize * 0.8} color={THEME.colors.goldLight} />
                  <Text style={[styles.actionButtonLabel, { fontSize: btnFont * 0.8 }]}>
                    ×{nextMultiplier(multiplier)}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.rollButton, { minWidth: clamp(winH * 0.17, 60, 96), paddingVertical: s(9) }]} onPress={rollDice}>
                <Ionicons name="dice" size={iconSize} color={THEME.colors.textDark} />
                <Text style={[styles.rollButtonLabel, { fontSize: btnFont }]}>ZAR AT</Text>
              </TouchableOpacity>
            </View>
          )}

          {isPlayerTurn && gamePhase === 'moving' && moveHistory.length > 0 && (
            <TouchableOpacity style={[styles.actionButton, { minWidth: clamp(winH * 0.155, 54, 88), paddingVertical: s(7) }]} onPress={undoMove}>
              <Ionicons name="arrow-undo" size={iconSize * 0.85} color="#FFF" />
              <Text style={[styles.actionButtonLabel, { fontSize: btnFont * 0.85 }]}>Geri Al</Text>
            </TouchableOpacity>
          )}

          {isPlayerTurn && gamePhase === 'moving' && turnFinished && (
            <TouchableOpacity style={[styles.actionButton, styles.endTurnButton, { minWidth: clamp(winH * 0.155, 54, 88), paddingVertical: s(7) }]} onPress={endTurn}>
              <Ionicons name="play-forward" size={iconSize * 0.85} color={THEME.colors.textDark} />
              <Text style={[styles.actionButtonLabel, styles.endTurnLabel, { fontSize: btnFont * 0.85 }]}>Turu Bitir</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sağ Kenar - Rakip Bilgileri */}
      <View style={[styles.sidebar, { width: sidebarW }]}>
        <PlayerInfo 
          name="Rakip"
          color={opponentColor}
          isActive={!isPlayerTurn}
          pips={opponentPips}
          borneOff={opponentBorneOff}
          avatarSize={avatarSize}
          font={font}
        />
        
        <TouchableOpacity style={styles.menuButton} onPress={pauseGame}>
          <Ionicons name="menu" size={clamp(winH * 0.065, 22, 34)} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Bakiye ve masa bahsi */}
      <View style={styles.walletBar} pointerEvents="none">
        <View style={styles.walletChip}>
          <Ionicons name="cash" size={labelFont * 1.15} color={THEME.colors.gold} />
          <Text style={[styles.walletText, { fontSize: labelFont }]}>{formatCoins(balance)}</Text>
        </View>
        <View style={styles.walletChip}>
          <Text style={[styles.stakeLabel, { fontSize: labelFont * 0.85 }]}>{table.name}</Text>
          <Text style={[styles.walletText, { fontSize: labelFont }]}>{formatCoins(stake * multiplier)}</Text>
          {multiplier > 1 && (
            <View style={styles.multiplierBadge}>
              <Text style={[styles.multiplierText, { fontSize: labelFont * 0.8 }]}>×{multiplier}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Oyun Bitti Overlay */}
      {gamePhase === 'game_over' && (
        <View style={styles.overlay}>
          <View style={styles.overlayBox}>
            <Text style={styles.overlayTitle}>
              {winner === playerColor ? 'Kazandınız!' : 'Kaybettiniz'}
            </Text>
            {winType === 'mars' && (
              <View style={styles.marsBadge}>
                <Text style={styles.marsText}>MARS · {winPoints} PUAN</Text>
              </View>
            )}
            <Text style={styles.overlaySubtitle}>
              {winType === 'mars'
                ? (winner === playerColor
                    ? 'Rakip hiç taş toplayamadı.'
                    : 'Hiç taş toplayamadınız.')
                : `${winPoints} puan`}
            </Text>

            <View style={[styles.payoutBox, lastPayout >= 0 ? styles.payoutWin : styles.payoutLose]}>
              <Ionicons
                name={lastPayout >= 0 ? 'trending-up' : 'trending-down'}
                size={18}
                color={lastPayout >= 0 ? THEME.colors.success : THEME.colors.danger}
              />
              <Text style={[styles.payoutText, { color: lastPayout >= 0 ? THEME.colors.success : THEME.colors.danger }]}>
                {lastPayout >= 0 ? '+' : '−'}{formatCoins(Math.abs(lastPayout))}
              </Text>
              <View style={styles.payoutBalanceRow}>
                <Text style={styles.payoutBalance}>Bakiye </Text>
                <CountUp from={balance - lastPayout} to={balance} style={styles.payoutBalance} />
              </View>
            </View>

            <View style={styles.statsRow}>
              <Text style={styles.statsChip}>Oynanan {stats.played}</Text>
              <Text style={styles.statsChip}>Galibiyet {stats.won}</Text>
              <Text style={styles.statsChip}>Mağlubiyet {stats.lost}</Text>
            </View>
            <TouchableOpacity style={styles.overlayBtn} onPress={resetGame}>
              <Text style={styles.overlayBtnText}>Yeni Oyun</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.overlayBtn, styles.overlayBtnSecondary]} onPress={goToMenu}>
              <Text style={styles.overlayBtnText}>Ana Menü</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Duraklatma Overlay — oyun fazından bağımsız, her an açılabilir */}
      {isPaused && gamePhase !== 'game_over' && (
        <View style={styles.overlay}>
          <View style={styles.overlayBox}>
            <Text style={styles.overlayTitle}>MENÜ</Text>
            <TouchableOpacity style={styles.overlayBtn} onPress={resumeGame}>
              <Text style={styles.overlayBtnText}>Devam Et</Text>
            </TouchableOpacity>

            <View style={styles.settingsGroup}>
              <TouchableOpacity style={styles.settingRow} onPress={toggleSound}>
                <Ionicons
                  name={settings.sound ? 'volume-high' : 'volume-mute'}
                  size={20}
                  color={settings.sound ? THEME.colors.goldLight : THEME.colors.textSecondary}
                />
                <Text style={styles.settingText}>Ses</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingRow} onPress={toggleHaptics}>
                <Ionicons
                  name={settings.haptics ? 'phone-portrait' : 'phone-portrait-outline'}
                  size={20}
                  color={settings.haptics ? THEME.colors.goldLight : THEME.colors.textSecondary}
                />
                <Text style={styles.settingText}>Titreşim</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <Text style={styles.statsChip}>G {stats.won}</Text>
              <Text style={styles.statsChip}>M {stats.lost}</Text>
              <Text style={styles.statsChip}>Mars {stats.marsWon}</Text>
            </View>

            <TouchableOpacity
              style={styles.overlayBtn}
              onPress={() => (inProgress ? setConfirmAction('newGame') : resetGame())}
            >
              <Text style={styles.overlayBtnText}>Yeni Oyun</Text>
            </TouchableOpacity>

            {inProgress && (
              <TouchableOpacity
                style={[styles.overlayBtn, styles.resignBtn]}
                onPress={() => setConfirmAction('resign')}
              >
                <Text style={styles.overlayBtnText}>Pes Et</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.overlayBtn, styles.overlayBtnSecondary]} onPress={goToMenu}>
              <Text style={styles.overlayBtnText}>Ana Menü</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Rakipten gelen katlama teklifi */}
      {raiseOffer && raiseOffer.by !== playerColor && (
        <View style={styles.overlay}>
          <View style={styles.overlayBox}>
            <Ionicons name="trending-up" size={s(30)} color={THEME.colors.gold} />
            <Text style={styles.confirmTitle}>Rakip bahsi katlamak istiyor</Text>
            <Text style={styles.confirmText}>
              Kabul ederseniz oyun{' '}
              <Text style={styles.confirmAmount}>{formatCoins(stake * raiseOffer.to)}</Text>{' '}
              değerinde olur ve katlama hakkı size geçer.
              {'\n'}Reddederseniz{' '}
              <Text style={styles.confirmAmount}>{formatCoins(stake * multiplier)}</Text>{' '}
              kaybedip oyun biter.
            </Text>

            <TouchableOpacity style={styles.overlayBtn} onPress={() => respondToRaise(true)}>
              <Text style={styles.overlayBtnText}>Kabul et (×{raiseOffer.to})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.overlayBtn, styles.resignBtn]}
              onPress={() => respondToRaise(false)}
            >
              <Text style={styles.overlayBtnText}>Pas geç</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Kendi teklifimiz beklemede */}
      {raiseOffer && raiseOffer.by === playerColor && (
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.overlayBox}>
            <Text style={styles.confirmTitle}>Teklif iletildi</Text>
            <Text style={styles.confirmText}>Rakip düşünüyor...</Text>
          </View>
        </View>
      )}

      {/* Bahis kaybettiren eylemler için onay */}
      {confirmAction && (
        <View style={styles.overlay}>
          <View style={styles.overlayBox}>
            <Ionicons name="warning" size={s(30)} color={THEME.colors.danger} />
            <Text style={styles.confirmTitle}>
              {confirmAction === 'resign' ? 'Pes etmek istiyor musunuz?' : 'Oyunu bırakıp yeni oyun?'}
            </Text>
            <Text style={styles.confirmText}>
              Devam eden oyun yenilgi sayılır ve{' '}
              <Text style={styles.confirmAmount}>{formatCoins(stake)}</Text> kaybedersiniz.
            </Text>

            <TouchableOpacity
              style={[styles.overlayBtn, styles.resignBtn]}
              onPress={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === 'resign') resignGame();
                else resetGame();
              }}
            >
              <Text style={styles.overlayBtnText}>
                {confirmAction === 'resign' ? 'Evet, pes ediyorum' : 'Evet, yeni oyun'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.overlayBtn, styles.overlayBtnSecondary]}
              onPress={() => setConfirmAction(null)}
            >
              <Text style={styles.overlayBtnText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.menuBg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // dolgu güvenli alana göre bileşende veriliyor
  },
  sidebar: {
    // genişlik oransal, bileşende veriliyor
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  diceOverlay: {
    position: 'absolute',
    left: '14%',
    top: '38%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  diceTray: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.gold,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  openingLabel: {
    color: THEME.colors.gold,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  actionOverlay: {
    position: 'absolute',
    right: '11%',
    top: '34%',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    zIndex: 50,
  },
  actionButton: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6b5636',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  actionButtonLabel: {
    color: '#FFF',
    fontWeight: 'bold',
    marginTop: 3,
  },
  endTurnButton: {
    backgroundColor: THEME.colors.gold,
    borderColor: '#FFF',
  },
  endTurnLabel: {
    color: THEME.colors.textDark,
  },
  rollButton: {
    backgroundColor: THEME.colors.gold,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 8,
  },
  rollButtonLabel: {
    color: THEME.colors.textDark,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 3,
  },
  playerInfo: {
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#3a2a18',
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  activePlayer: {
    borderColor: THEME.colors.gold,
    shadowColor: THEME.colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },
  turnBadge: {
    position: 'absolute',
    top: -9,
    backgroundColor: THEME.colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 1.5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  turnBadgeText: {
    color: THEME.colors.textDark,
    fontWeight: '900',
    letterSpacing: 1,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
    marginTop: 2,
  },
  avatar: {
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerName: {
    color: THEME.colors.textPrimary,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  statsContainer: {
    width: '100%',
    gap: 3,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  statLabel: {
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  statValue: {
    color: THEME.colors.goldLight,
    fontWeight: 'bold',
  },
  messageText: {
    color: THEME.colors.goldLight,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
  },
  menuButton: {
    position: 'absolute',
    bottom: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: THEME.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  overlayBox: {
    backgroundColor: THEME.colors.boardFrame,
    padding: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: THEME.colors.gold,
    alignItems: 'center',
    minWidth: 250,
  },
  overlayTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME.colors.gold,
    marginBottom: 12,
    textAlign: 'center',
  },
  overlaySubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: 14,
    textAlign: 'center',
  },
  marsBadge: {
    backgroundColor: THEME.colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  marsText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statsChip: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  settingsGroup: {
    flexDirection: 'row',
    gap: 22,
    marginBottom: 14,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  settingText: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
  },
  diceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  doublesBadge: {
    backgroundColor: THEME.colors.gold,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  doublesText: {
    color: THEME.colors.textDark,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  remainingText: {
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  resignBtn: {
    backgroundColor: 'rgba(231,76,60,0.85)',
  },
  confirmTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  confirmText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  confirmAmount: {
    color: THEME.colors.danger,
    fontWeight: 'bold',
  },
  payoutBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  multiplierBadge: {
    backgroundColor: THEME.colors.danger,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 2,
  },
  multiplierText: {
    color: '#FFF',
    fontWeight: '900',
  },
  rollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  raiseButton: {
    backgroundColor: 'rgba(212,175,55,0.28)',
    borderWidth: 1.5,
    borderColor: THEME.colors.gold,
    paddingHorizontal: 6,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  raiseNotice: {
    color: THEME.colors.goldLight,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 6,
  },
  walletBar: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    zIndex: 40,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
  },
  walletText: {
    color: THEME.colors.goldLight,
    fontWeight: 'bold',
  },
  stakeLabel: {
    color: THEME.colors.textSecondary,
  },
  payoutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  payoutWin: {
    backgroundColor: 'rgba(46,204,113,0.12)',
    borderColor: 'rgba(46,204,113,0.5)',
  },
  payoutLose: {
    backgroundColor: 'rgba(231,76,60,0.12)',
    borderColor: 'rgba(231,76,60,0.5)',
  },
  payoutText: {
    fontSize: 18,
    fontWeight: '900',
  },
  payoutBalance: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
  },
  overlayBtn: {
    backgroundColor: THEME.colors.buttonPrimary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 12,
    width: 200,
    alignItems: 'center',
  },
  overlayBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: THEME.colors.buttonPrimary,
  },
  overlayBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default GameScreen;
