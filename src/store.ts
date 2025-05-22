import { combineReducers, configureStore, Reducer, AnyAction } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import rootSaga from './sagas/rootSaga';
import { authReducer } from './slices/authSlice';
import { kitchensReducer } from './slices/kitchensSlice';
import devToolsEnhancer from "redux-devtools-expo-dev-plugin";
import {
    persistStore,
    persistReducer,
    Persistor,
    PersistState
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    FLUSH,
    REHYDRATE,
    PAUSE,
    PERSIST,
    PURGE as REDUX_PERSIST_PURGE,
    REGISTER,
} from 'redux-persist';
import { appLogger } from './services/AppLogService';

const authPersistConfig = {
    key: 'auth',
    storage: AsyncStorage,
    blacklist: ['loading', 'error']
};

const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);

const baseRootReducer = combineReducers({
    auth: persistedAuthReducer,
    kitchens: kitchensReducer,
});

type BaseRootReducerState = ReturnType<typeof baseRootReducer>;

const initialRootState: BaseRootReducerState = baseRootReducer(undefined, { type: '@@INIT_FOR_PURGE' as any });

const rootPersistConfig = {
    key: 'root',
    storage: AsyncStorage,
    whitelist: ['kitchens']
};

const persistedRootReducer = persistReducer(rootPersistConfig, baseRootReducer);

const PURGE_ACTION_TYPE = 'persist/PURGE_REQUESTED';

let persistorInstance: Persistor | null = null;

const createPurgeableReducer = <
    S extends BaseRootReducerState,
    A extends AnyAction
>(
    reducerToWrap: Reducer<S & { _persist: PersistState }, A>,
    getPersistor: () => Persistor,
    initialStateForReset: S
): Reducer<S & { _persist?: PersistState }, A> => {
  return (state: (S & { _persist?: PersistState }) | undefined, action: A): S & { _persist?: PersistState } => {
    if (action.type === PURGE_ACTION_TYPE) {
      const persistor = getPersistor();
      if (persistor) {
        appLogger.log('--- [Store] Purge action received, calling persistor.purge()');
        persistor.purge().then(() => {
            appLogger.log('--- [Store] Persistor purge completed.');
        }).catch((err) => {
            appLogger.error('--- [Store] Persistor purge failed:', err);
        });
      }

      return initialStateForReset;
    }

    return reducerToWrap(state as (S & { _persist: PersistState }) | undefined, action);
  };
};

const sagaMiddleware = createSagaMiddleware();

const finalReducer = createPurgeableReducer<BaseRootReducerState, AnyAction>(
    persistedRootReducer,
    () => {
        if (!persistorInstance) {
            throw new Error("Persistor has not been initialized yet.");
        }
        return persistorInstance;
    },
    initialRootState
);

const store = configureStore({
    reducer: finalReducer,
    middleware: getDefaultMiddleware =>
        getDefaultMiddleware({
            thunk: false,
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, REDUX_PERSIST_PURGE, REGISTER, PURGE_ACTION_TYPE],
            },
        }).concat(sagaMiddleware),
    devTools: process.env.NODE_ENV !== 'production',
    enhancers: (getDefaultEnhancers) => {
        const enhancers = getDefaultEnhancers();
        if (process.env.NODE_ENV !== 'production' && devToolsEnhancer) {
            return enhancers.concat(devToolsEnhancer());
        }
        return enhancers;
    },
});

persistorInstance = persistStore(store);

sagaMiddleware.run(rootSaga);

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const getPersistor = (): Persistor => {
    if (!persistorInstance) {
        throw new Error("Persistor has not been initialized yet. Ensure you call this after store setup.");
    }
    return persistorInstance;
};

