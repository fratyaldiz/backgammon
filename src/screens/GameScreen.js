import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useGameStore from '../store/gameStore';
import Board from '../components/Board';
import Dice, { Die } from '../components/Dice';
import THEME from '../constants/theme';
import { WHITE, BLACK } from '../utils/diceUtils';
import { getPipCount } from '../utils/gameLogic';
import { getTable, formatCoins } from '../utils/economy';
import { Ionicons } from '@expo/vector-icons';

const PlayerInfo = ({ name, color, isActive, pips, borneOff }) => {
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
          <Text style={styles.turnBadgeText}>SIRA</Text>
        </View>
      )}
      <View style={[
        styles.avatar,
        { backgroundColor: isWhite ? '#F0E6D2' : '#1A1A2E', borderColor: isActive ? THEME.colors.gold : '#555' },
      ]}>
        <Ionicons name="person" size={20} color={isWhite ? '#1A1A2E' : '#F0E6D2'} />
      </View>
      <Text style={styles.playerName}>{name}</Text>
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Pip</Text>
          <Text style={styles.statValue}>{pips}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Toplanan</Text>
          <Text style={styles.statValue}>{borneOff}/15</Text>
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
    balance, stake, lastPayout, tableId
  } = useGameStore();

  const isOpeningRoll = gamePhase === 'opening_roll';
  const table = getTable(tableId);

  const opponentColor = playerColor === WHITE ? BLACK : WHITE;

  const playerPips = getPipCount(board, bar, playerColor);
  const opponentPips = getPipCount(board, bar, opponentColor);

  const playerBorneOff = playerColor === WHITE ? borneOff.white : borneOff.black;
  const opponentBorneOff = opponentColor === WHITE ? borneOff.white : borneOff.black;

  const playerName = playerColor === WHITE ? 'Siz (Beyaz)' : 'Siz (Siyah)';
  const isPlayerTurn = currentPlayer === playerColor;

  return (
    <View style={styles.container}>
      {/* Sol Kenar - Oyuncu Bilgileri */}
      <View style={styles.sidebar}>
        <PlayerInfo 
          name={playerName}
          color={playerColor}
          isActive={isPlayerTurn}
          pips={playerPips}
          borneOff={playerBorneOff}
        />
        {message ? <Text style={styles.messageText}>{message}</Text> : null}
      </View>

      {/* Orta Alan - Tahta */}
      <View style={styles.boardWrapper}>
        <Board />
        
        {/* SOL: rakibin açılış zarı, ya da oyundaki atılmış zarlar */}
        {isOpeningRoll ? (
          openingDice.ai !== null && (
            <View style={styles.diceOverlay}>
              <LinearGradient
                colors={THEME.gradients.diceTray}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.diceTray}
              >
                <Text style={styles.openingLabel}>RAKİP</Text>
                <Die value={openingDice.ai} isUsed={false} rolling={openingRolling} />
              </LinearGradient>
            </View>
          )
        ) : (
          dice && (
            <View style={styles.diceOverlay}>
              <LinearGradient
                colors={THEME.gradients.diceTray}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.diceTray}
              >
                <Dice
                  dice={dice}
                  remainingMoves={remainingMoves}
                  rolling={false}
                  onRoll={null}
                />
              </LinearGradient>
            </View>
          )
        )}

        {/* SAĞ: kendi açılış zarım + aksiyon butonları */}
        <View style={styles.actionOverlay}>
          {isOpeningRoll && openingDice.player !== null && (
            <LinearGradient
              colors={THEME.gradients.diceTray}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.diceTray}
            >
              <Text style={styles.openingLabel}>SİZ</Text>
              <Die value={openingDice.player} isUsed={false} rolling={openingRolling} />
            </LinearGradient>
          )}

          {isOpeningRoll && openingDice.player === null && !openingRolling && (
            <TouchableOpacity style={styles.rollButton} onPress={rollOpeningDice}>
              <Ionicons name="dice" size={24} color={THEME.colors.textDark} />
              <Text style={styles.rollButtonLabel}>ZAR AT</Text>
            </TouchableOpacity>
          )}

          {isPlayerTurn && gamePhase === 'rolling' && (
            <TouchableOpacity style={styles.rollButton} onPress={rollDice}>
              <Ionicons name="dice" size={24} color={THEME.colors.textDark} />
              <Text style={styles.rollButtonLabel}>ZAR AT</Text>
            </TouchableOpacity>
          )}

          {isPlayerTurn && gamePhase === 'moving' && moveHistory.length > 0 && (
            <TouchableOpacity style={styles.actionButton} onPress={undoMove}>
              <Ionicons name="arrow-undo" size={22} color="#FFF" />
              <Text style={styles.actionButtonLabel}>Geri Al</Text>
            </TouchableOpacity>
          )}

          {isPlayerTurn && gamePhase === 'moving' && turnFinished && (
            <TouchableOpacity style={[styles.actionButton, styles.endTurnButton]} onPress={endTurn}>
              <Ionicons name="play-forward" size={22} color={THEME.colors.textDark} />
              <Text style={[styles.actionButtonLabel, styles.endTurnLabel]}>Turu Bitir</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sağ Kenar - Rakip Bilgileri */}
      <View style={styles.sidebar}>
        <PlayerInfo 
          name="Rakip"
          color={opponentColor}
          isActive={!isPlayerTurn}
          pips={opponentPips}
          borneOff={opponentBorneOff}
        />
        
        <TouchableOpacity style={styles.menuButton} onPress={pauseGame}>
          <Ionicons name="menu" size={28} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Bakiye ve masa bahsi */}
      <View style={styles.walletBar} pointerEvents="none">
        <View style={styles.walletChip}>
          <Ionicons name="cash" size={13} color={THEME.colors.gold} />
          <Text style={styles.walletText}>{formatCoins(balance)}</Text>
        </View>
        <View style={styles.walletChip}>
          <Text style={styles.stakeLabel}>{table.name}</Text>
          <Text style={styles.walletText}>{formatCoins(stake)}</Text>
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
              <Text style={styles.payoutBalance}>Bakiye {formatCoins(balance)}</Text>
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

            <TouchableOpacity style={styles.overlayBtn} onPress={resetGame}>
              <Text style={styles.overlayBtnText}>Yeni Oyun</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.overlayBtn, styles.overlayBtnSecondary]} onPress={goToMenu}>
              <Text style={styles.overlayBtnText}>Ana Menü</Text>
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
    padding: 10,
  },
  sidebar: {
    width: 100,
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
    padding: 8,
    borderRadius: 14,
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
    fontSize: 9,
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
    minWidth: 66,
    paddingVertical: 8,
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
    fontSize: 10,
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
    minWidth: 72,
    paddingVertical: 10,
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
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 3,
  },
  playerInfo: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3a2a18',
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
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
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  turnBadgeText: {
    color: THEME.colors.textDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  playerName: {
    color: THEME.colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  statsContainer: {
    width: '100%',
    gap: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  statValue: {
    color: THEME.colors.goldLight,
    fontSize: 11,
    fontWeight: 'bold',
  },
  messageText: {
    color: THEME.colors.goldLight,
    fontWeight: 'bold',
    fontSize: 11,
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
    fontSize: 12,
    fontWeight: 'bold',
  },
  stakeLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 10,
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
