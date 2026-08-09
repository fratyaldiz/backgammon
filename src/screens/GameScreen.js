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
      <Text style={styles.playerName}>{name}</Text>
      <Text style={styles.playerName}>{name}</Text>
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>Pip: {pips}</Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>Toplanan: {borneOff}</Text>
        </View>
      </View>
    </View>
  );
};

const GameScreen = () => {
  const { 
    board, bar, currentPlayer, gamePhase, dice, remainingMoves, rollDice, 
    borneOff, message, winner, goToMenu, resetGame,
    turnFinished, moveHistory, undoMove, endTurn
  } = useGameStore();

  const whitePips = getPipCount(board, bar, WHITE);
  const blackPips = getPipCount(board, bar, BLACK);

  return (
    <View style={styles.container}>
      {/* Sol Kenar (Sizin Bilgileriniz) */}
      <View style={styles.sidebar}>
        <PlayerInfo 
          name="Siz" 
          color={WHITE} 
          isActive={currentPlayer === WHITE} 
          pips={whitePips}
          borneOff={borneOff.white}
        />
        {message ? <Text style={styles.messageTextSidebar}>{message}</Text> : null}
      </View>

      {/* Orta Alan (Tavla Tahtası ve Yüzen Zarlar) */}
      <View style={styles.boardWrapper}>
        <Board />
        
        <View style={styles.diceOverlay}>
          <View style={styles.diceArea}>
            <Dice 
              dice={dice} 
              remainingMoves={remainingMoves} 
              rolling={gamePhase === 'rolling' && dice !== null}
              onRoll={gamePhase === 'rolling' && currentPlayer === WHITE ? rollDice : null}
            />
          </View>
          
          <View style={styles.actionButtonsRow}>
            {currentPlayer === WHITE && gamePhase === 'moving' && moveHistory.length > 0 && (
              <TouchableOpacity style={styles.actionButton} onPress={undoMove}>
                <Ionicons name="arrow-undo" size={24} color="#FFF" />
              </TouchableOpacity>
            )}
            
            {currentPlayer === WHITE && gamePhase === 'moving' && turnFinished && (
              <TouchableOpacity style={[styles.actionButton, styles.endTurnButton]} onPress={endTurn}>
                <Ionicons name="play-forward" size={24} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Sağ Kenar (Rakip Bilgileri) */}
      <View style={styles.sidebar}>
        <PlayerInfo 
          name="Rakip" 
          color={BLACK} 
          isActive={currentPlayer === BLACK} 
          pips={blackPips}
          borneOff={borneOff.black}
        />
        
        <TouchableOpacity style={styles.menuButton} onPress={goToMenu}>
          <Ionicons name="menu" size={28} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {gamePhase === 'game_over' && (
        <View style={styles.gameOverOverlay}>
          <View style={styles.gameOverBox}>
            <Text style={styles.gameOverTitle}>
              {winner === WHITE ? 'Tebrikler!' : 'Kaybettiniz'}
            </Text>
            <TouchableOpacity style={styles.button} onPress={resetGame}>
              <Text style={styles.buttonText}>Yeni Oyun</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={goToMenu}>
              <Text style={styles.buttonText}>Ana Menü</Text>
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
    top: '40%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  playerInfo: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#333',
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  activePlayer: {
    borderColor: THEME.colors.gold,
    shadowColor: THEME.colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  playerName: {
    color: THEME.colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 5,
  },
  statsContainer: {
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 2,
  },
  statsText: {
    color: THEME.colors.textSecondary,
    fontSize: 11,
  },
  messageTextSidebar: {
    color: THEME.colors.goldLight,
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
  diceArea: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 15,
  },
  actionButton: {
    backgroundColor: '#333',
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
  menuButton: {
    position: 'absolute',
    bottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  gameOverBox: {
    backgroundColor: THEME.colors.boardFrame,
    padding: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: THEME.colors.gold,
    alignItems: 'center',
  },
  gameOverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: THEME.colors.gold,
    marginBottom: 30,
  },
  button: {
    backgroundColor: THEME.colors.buttonPrimary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 15,
    width: 200,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: THEME.colors.buttonPrimary,
  },
  buttonText: {
    color: THEME.colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default GameScreen;
