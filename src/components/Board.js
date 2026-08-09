import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import useGameStore from '../store/gameStore';
import Checker from './Checker';
import THEME from '../constants/theme';
import { WHITE, BLACK } from '../utils/diceUtils';

const { width, height } = Dimensions.get('window');

const Point = ({ index, isUp, checkers, owner, isSelected, isDestination, onPress }) => {
  const color = index % 2 === 0 ? THEME.colors.triangleDark : THEME.colors.triangleLight;
  
  return (
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={onPress}
      style={[styles.pointContainer, isUp ? styles.pointUp : styles.pointDown]}
    >
      <View style={[
        styles.triangle,
        isUp ? styles.triangleUp : styles.triangleDown,
        { borderBottomColor: isUp ? color : 'transparent', borderTopColor: !isUp ? color : 'transparent' },
        isDestination && { opacity: 0.6 }
      ]}>
        {isDestination && <View style={[styles.highlight, isUp ? styles.highlightUp : styles.highlightDown]} />}
      </View>
      
      <View style={[styles.checkersContainer, isUp ? { bottom: 0 } : { top: 0 }]}>
        {Array.from({ length: Math.min(checkers, 5) }).map((_, i) => (
          <View key={i} style={{ marginTop: isUp ? -12 : (i === 0 ? 0 : -12) }}>
            <Checker 
              color={owner} 
              isSelected={isSelected && i === checkers - 1} 
              count={i === 4 && checkers > 5 ? checkers : null} 
            />
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
};

const Board = () => {
  const { board, bar, borneOff, selectPoint, selectedPoint, validDestinations, currentPlayer } = useGameStore();

  const renderQuadrant = (indices, isUp) => {
    return (
      <View style={styles.quadrant}>
        {indices.map(i => {
          const count = Math.abs(board[i]);
          const owner = Math.sign(board[i]);
          return (
            <Point 
              key={i} 
              index={i} 
              isUp={isUp}
              checkers={count}
              owner={owner}
              isSelected={selectedPoint === i}
              isDestination={validDestinations.includes(i)}
              onPress={() => selectPoint(i)}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.boardContainer}>
      <View style={styles.bearOffArea}>
        <TouchableOpacity style={styles.bearOffBox} onPress={() => selectPoint('off')}>
          <Text style={styles.bearOffText}>{borneOff.white}</Text>
          <Checker color={WHITE} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bearOffBox} onPress={() => selectPoint('off')}>
          <Text style={styles.bearOffText}>{borneOff.black}</Text>
          <Checker color={BLACK} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.mainBoard}>
        <View style={styles.halfBoard}>
          {renderQuadrant([12, 13, 14, 15, 16, 17], false)}
          {renderQuadrant([11, 10, 9, 8, 7, 6], true)}
        </View>
        
        <TouchableOpacity style={styles.bar} onPress={() => selectPoint('bar')}>
          <View style={styles.barCheckers}>
            {Array.from({ length: bar.black }).map((_, i) => (
              <Checker key={`b${i}`} color={BLACK} isSelected={selectedPoint === 'bar' && currentPlayer === BLACK} />
            ))}
          </View>
          <View style={styles.barCheckers}>
            {Array.from({ length: bar.white }).map((_, i) => (
              <Checker key={`w${i}`} color={WHITE} isSelected={selectedPoint === 'bar' && currentPlayer === WHITE} />
            ))}
          </View>
        </TouchableOpacity>
        
        <View style={styles.halfBoard}>
          {renderQuadrant([18, 19, 20, 21, 22, 23], false)}
          {renderQuadrant([5, 4, 3, 2, 1, 0], true)}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  boardContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.boardFrame,
    padding: THEME.sizes.borderWidth,
    borderRadius: 8,
    borderWidth: 4,
    borderColor: THEME.colors.boardFrameInner,
    width: '100%',
    height: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  bearOffArea: {
    width: THEME.sizes.bearOffWidth,
    backgroundColor: THEME.colors.bearOffBg,
    marginRight: 8,
    justifyContent: 'space-between',
    paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 2,
    borderColor: THEME.colors.boardFrameInner,
  },
  bearOffBox: {
    alignItems: 'center',
  },
  bearOffText: {
    color: THEME.colors.textPrimary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  mainBoard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: THEME.colors.boardLight,
  },
  halfBoard: {
    flex: 1,
    justifyContent: 'space-between',
  },
  quadrant: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: '45%',
  },
  bar: {
    width: THEME.sizes.barWidth,
    backgroundColor: THEME.colors.barColor,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: THEME.colors.boardFrameInner,
    justifyContent: 'space-between',
    paddingVertical: 20,
    alignItems: 'center',
  },
  barCheckers: {
    gap: 4,
  },
  pointContainer: {
    width: THEME.sizes.pointWidth,
    alignItems: 'center',
  },
  pointUp: {
    justifyContent: 'flex-end',
  },
  pointDown: {
    justifyContent: 'flex-start',
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: THEME.sizes.pointWidth / 2,
    borderRightWidth: THEME.sizes.pointWidth / 2,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
  },
  triangleUp: {
    bottom: 0,
    borderBottomWidth: height * 0.35,
  },
  triangleDown: {
    top: 0,
    borderTopWidth: height * 0.35,
  },
  checkersContainer: {
    position: 'absolute',
    alignItems: 'center',
    width: '100%',
  },
  highlight: {
    position: 'absolute',
    borderLeftWidth: THEME.sizes.pointWidth / 2,
    borderRightWidth: THEME.sizes.pointWidth / 2,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    left: -THEME.sizes.pointWidth / 2,
  },
  highlightUp: {
    borderBottomWidth: height * 0.35,
    borderBottomColor: THEME.colors.triangleHighlight,
    top: 0,
  },
  highlightDown: {
    borderTopWidth: height * 0.35,
    borderTopColor: THEME.colors.triangleHighlight,
    bottom: 0,
  },
});

export default Board;
