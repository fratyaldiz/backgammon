import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useGameStore from '../store/gameStore';
import Board from '../components/Board';
import Dice from '../components/Dice';
import THEME from '../constants/theme';
import { WHITE, BLACK } from '../utils/diceUtils';
import { getPipCount } from '../utils/gameLogic';
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
    pauseGame, resumeGame
  } = useGameStore();

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
        
        {/* Atılan Zarlar (SOL) */}
        {dice && (
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
        )}

        {/* Aksiyon Butonları (SAĞ) */}
        <View style={styles.actionOverlay}>
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

      {/* Oyun Bitti Overlay */}
      {gamePhase === 'game_over' && (
        <View style={styles.overlay}>
          <View style={styles.overlayBox}>
            <Text style={styles.overlayTitle}>
              {winner === playerColor ? 'Tebrikler! Kazandınız!' : 'Kaybettiniz!'}
            </Text>
            <TouchableOpacity style={styles.overlayBtn} onPress={resetGame}>
              <Text style={styles.overlayBtnText}>Yeni Oyun</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.overlayBtn, styles.overlayBtnSecondary]} onPress={goToMenu}>
              <Text style={styles.overlayBtnText}>Ana Menü</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Duraklatma Overlay */}
      {gamePhase === 'paused' && (
        <View style={styles.overlay}>
          <View style={styles.overlayBox}>
            <Text style={styles.overlayTitle}>OYUN DURAKLATILDI</Text>
            <TouchableOpacity style={styles.overlayBtn} onPress={resumeGame}>
              <Text style={styles.overlayBtnText}>Devam Et</Text>
            </TouchableOpacity>
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
    marginBottom: 25,
    textAlign: 'center',
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
