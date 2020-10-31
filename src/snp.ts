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
} from "../generated/schema";

const MASTER_ADDY = '0x7C5592faD8031e62318DAbD81e2211E50A231Ffb'

export function handleDeposit(event: Deposit): void {
  let pool = getPoolEntity(event.params.pid, event.block);
  let user = getPoolUserEntity(event.params.pid,event.params.user);
  let snpMaster = SnpMaster.bind(Address.fromString(MASTER_ADDY));
  let info = snpMaster.poolInfo(event.params.pid)
  pool.balance = info.value2;//pool.balance.plus(event.params.amount);
  pool.save();
}

export function handleEmergencyWithdraw(event: EmergencyWithdraw): void {
  let pool = getPoolEntity(event.params.pid, event.block);
  let user = getPoolUserEntity(event.params.pid,event.params.user);
  let snpMaster = SnpMaster.bind(Address.fromString(MASTER_ADDY));
  let info = snpMaster.poolInfo(event.params.pid)
  pool.balance = info.value2;//pool.balance.minus(event.params.amount);
  pool.save();
}

export function handleWithdraw(event: Withdraw): void {
  let pool = getPoolEntity(event.params.pid, event.block);
  let user = getPoolUserEntity(event.params.pid,event.params.user);
  let snpMaster = SnpMaster.bind(Address.fromString(MASTER_ADDY));
  let info = snpMaster.poolInfo(event.params.pid)
  pool.balance = info.value2;//pool.balance.minus(event.params.amount);
  pool.save();
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
  let user = SnpMasterPoolUser.load(poolId.toString()+address.toString());
  let userInfo = snpMaster.userInfo(poolId,address);
  if (user == null) {
    // init new pool user entity
    user = new SnpMasterPoolUser(poolId.toString()+address.toString());
    user.balance = BigInt.fromI32(0);
    user.depositTime = BigInt.fromI32(0);
    user.poolid = poolId;
  }else{
    user.balance = userInfo.value0;
    user.depositTime = userInfo.value2;
    user.poolid = poolId;
  }

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
