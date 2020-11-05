import { BigInt, Address, ethereum, log } from "@graphprotocol/graph-ts"
import {
  SnpMaster,
  Deposit,
  EmergencyWithdraw,
  Withdraw,
  SetCall
} from "../generated/SnpMaster/SnpMaster"

import {
  SnpMaster as SnpMasterEntity,
  SnpMasterPool,
  SnpMasterPoolUser,
  SnpPoolDayData,
  SnpPoolTransation
} from "../generated/schema";

const MASTER_ADDY = '0x7C5592faD8031e62318DAbD81e2211E50A231Ffb'

export function handleDeposit(event: Deposit): void {
  let pool = getPoolEntity(event.params.pid, event.block);
  let user = getPoolUserEntity(event.params.pid,event.params.user);
  let snpMaster = SnpMaster.bind(Address.fromString(MASTER_ADDY));
  let info = snpMaster.poolInfo(event.params.pid)
  pool.balance = info.value2;//pool.balance.plus(event.params.amount);
  pool.save();
  updatePoolDayData(event.params.pid,event);
  updateSnpPoolTransation(event.params.pid,event.params.amount,BigInt.fromI32(0),event);
}

export function handleEmergencyWithdraw(event: EmergencyWithdraw): void {
  let pool = getPoolEntity(event.params.pid, event.block);
  let user = getPoolUserEntity(event.params.pid,event.params.user);
  let snpMaster = SnpMaster.bind(Address.fromString(MASTER_ADDY));
  let info = snpMaster.poolInfo(event.params.pid)
  pool.balance = info.value2;//pool.balance.minus(event.params.amount);
  pool.save();
  updatePoolDayData(event.params.pid,event);
  updateSnpPoolTransation(event.params.pid,event.params.amount,BigInt.fromI32(2),event);
}

export function handleWithdraw(event: Withdraw): void {
  let pool = getPoolEntity(event.params.pid, event.block);
  let user = getPoolUserEntity(event.params.pid,event.params.user);
  let snpMaster = SnpMaster.bind(Address.fromString(MASTER_ADDY));
  let info = snpMaster.poolInfo(event.params.pid)
  pool.balance = info.value2;//pool.balance.minus(event.params.amount);
  pool.save();
  updatePoolDayData(event.params.pid,event);
  updateSnpPoolTransation(event.params.pid,event.params.amount,BigInt.fromI32(1),event);
}

export function handleSetPoolAllocPoint(event: SetCall): void {
  let snpMaster = SnpMaster.bind(event.to);
  let pool = getPoolEntity(event.inputs._pid, event.block);

  // Update snpMasterEntity
  let snpMasterEntity = getSnpMasterEntity();
  snpMasterEntity.totalMintReward = snpMaster.totalMintReward();
  snpMasterEntity.save();

  // Update pool
  pool.allocPoint = event.inputs._allocPoint;
  pool.save();
}

function getPoolEntity(poolId: BigInt, block: ethereum.Block): SnpMasterPool {
  let snpMaster = SnpMaster.bind(Address.fromString(MASTER_ADDY));
  let pool = SnpMasterPool.load(poolId.toString());
  let poolInfo = snpMaster.poolInfo(poolId);

  if (pool == null) {
    // init new pool entity
    pool = new SnpMasterPool(poolId.toString());
    pool.balance = BigInt.fromI32(0);
    pool.addedBlock = block.number;
    pool.addedTs = block.timestamp;

    //update snpMasterEntity
    let snpMasterEntity = getSnpMasterEntity();
    snpMasterEntity.poolLength = snpMaster.poolLength();
    snpMasterEntity.totalMintReward = snpMaster.totalMintReward();
    snpMasterEntity.save()
  }

  // Update pool
  pool.lpToken = poolInfo.value0;
  pool.allocPoint = poolInfo.value1;

  pool.save()

  return pool as SnpMasterPool;
}

function getPoolUserEntity(poolId: BigInt, address: Address): SnpMasterPoolUser {
  let snpMaster = SnpMaster.bind(Address.fromString(MASTER_ADDY));
  let user = SnpMasterPoolUser.load(poolId.toString()+address.toHexString());
  let userInfo = snpMaster.userInfo(poolId,address);
  if (user == null) {
    // init new pool user entity
    user = new SnpMasterPoolUser(poolId.toString()+address.toHexString());
    user.poolid = poolId;
    user.address = address
  }
  user.balance = userInfo.value0;
  user.depositTime = userInfo.value2;
  

  user.save()

  return user as SnpMasterPoolUser;
}

function getSnpMasterEntity(): SnpMasterEntity {
  let entity = SnpMasterEntity.load("1");

  if (entity == null) {
    entity = new SnpMasterEntity("1");
    entity.totalMintReward = BigInt.fromI32(0);
    entity.poolLength = BigInt.fromI32(0);
    entity.save();
  }

  return entity as SnpMasterEntity;
}

function updatePoolDayData(poolid: BigInt, event: ethereum.Event): SnpPoolDayData{

  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let poolDayID = poolid
    .toString()
    .concat('-')
    .concat(BigInt.fromI32(dayID).toString());

  let snpMaster = SnpMaster.bind(Address.fromString(MASTER_ADDY));
  let info  = snpMaster.poolInfo(poolid);
  let poolDayData = SnpPoolDayData.load(poolDayID)
  if (poolDayData === null) {
    poolDayData = new SnpPoolDayData(poolDayID)
    poolDayData.date = dayStartTimestamp
    poolDayData.poolid = poolid
    poolDayData.lpToken = info.value0;
    poolDayData.totalToken = BigInt.fromI32(0)
  }
  poolDayData.totalToken = info.value2;
  poolDayData.save();

  return poolDayData as SnpPoolDayData;
}

function updateSnpPoolTransation(poolid: BigInt,amount:BigInt,operator:BigInt, event: ethereum.Event): SnpPoolTransation{

  if (amount==BigInt.fromI32(0)){
    return null as SnpPoolTransation;
  }

  let timestamp = event.block.timestamp.toI32();
  let transactionHash = event.transaction.hash.toHexString()
  let poolTransation = SnpPoolTransation.load(transactionHash)
  if (poolTransation === null) {
    poolTransation = new SnpPoolTransation(transactionHash)
    poolTransation.blockNumber = event.block.number;
    poolTransation.timestamp = timestamp;
    poolTransation.address = event.transaction.from;
    poolTransation.poolid = poolid;
    poolTransation.operator = operator.toI32();
    poolTransation.amount = amount;
    poolTransation.save();
  }
  return poolTransation as SnpPoolTransation;
}