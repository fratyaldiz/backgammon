import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import useGameStore from '../store/gameStore';
import Board from '../components/Board';
import Dice from '../components/Dice';
import THEME from '../constants/theme';
import { WHITE, BLACK } from '../utils/diceUtils';
import { getPipCount } from '../utils/gameLogic';
import { Ionicons } from '@expo/vector-icons';

const PlayerInfo = ({ name, color, isActive, pips, borneOff }) => {
  return (
    <View style={[styles.playerInfo, isActive && styles.activePlayer]}>
      <View style={[styles.colorDot, { backgroundColor: color === WHITE ? '#FFF' : '#222' }]} />
      <Text style={styles.playerName}>{name}</Text>
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>Pip: {pips}</Text>
        <Text style={styles.statsText}>Toplanan: {borneOff}</Text>
      </View>
    </View>
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
        
        {/* Yüzen Zarlar */}
        <View style={styles.diceOverlay}>
          <View style={styles.diceArea}>
            <Dice 
              dice={dice} 
              remainingMoves={remainingMoves} 
              rolling={gamePhase === 'rolling' && dice !== null}
              onRoll={gamePhase === 'rolling' && isPlayerTurn ? rollDice : null}
            />
          </View>
          
          {/* Aksiyon Butonları */}
          <View style={styles.actionButtonsRow}>
            {isPlayerTurn && gamePhase === 'moving' && moveHistory.length > 0 && (
              <TouchableOpacity style={styles.actionButton} onPress={undoMove}>
                <Ionicons name="arrow-undo" size={22} color="#FFF" />
              </TouchableOpacity>
            )}
            
            {isPlayerTurn && gamePhase === 'moving' && turnFinished && (
              <TouchableOpacity style={[styles.actionButton, styles.endTurnButton]} onPress={endTurn}>
                <Ionicons name="play-forward" size={22} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
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
    left: '15%',
    top: '35%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  diceArea: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endTurnButton: {
    backgroundColor: THEME.colors.gold,
    borderColor: '#FFF',
  },
  playerInfo: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#333',
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  activePlayer: {
    borderColor: THEME.colors.gold,
    shadowColor: THEME.colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#888',
  },
  playerName: {
    color: THEME.colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  statsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  statsText: {
    color: THEME.colors.textSecondary,
    fontSize: 10,
    marginVertical: 1,
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
