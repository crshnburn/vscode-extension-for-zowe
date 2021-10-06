/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import * as vscode from "vscode";
import { ProfilesCache } from "@zowe/zowe-explorer-api";
import * as utils from "../../src/utils/ProfilesUtils";
import * as globals from "../../src/globals";
import { createInstanceOfProfile, createIProfile, createValidIProfile } from "../../__mocks__/mockCreators/shared";
import { Profiles } from "../../src/Profiles";

function createGlobalMocks() {
    const globalMocks = {
        isTheia: jest.fn(),
        testProfileLoaded: createValidIProfile(),
        mockProfileInstance: null,
    };

    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.testProfileLoaded);
    const isTheia = jest.fn();

    Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest
            .fn(() => {
                return { promptCredentials: ["test", "test", "test"] };
            })
            .mockReturnValue(globalMocks.mockProfileInstance),
        configurable: true,
    });
    Object.defineProperty(globals, "ISTHEIA", { get: isTheia, configurable: true });
    Object.defineProperty(utils, "isTheia", { value: jest.fn(), configurable: true });

    Object.defineProperty(ProfilesCache, "getConfigInstance", {
        value: jest.fn(() => {
            return {
                usingTeamConfig: false,
            };
        }),
    });

    return {
        isTheia,
    };
}

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("Utils Unit Tests - Function errorHandling", () => {
    function createBlockMocks() {
        const imperativeProfile = createIProfile();
        const profile = createInstanceOfProfile(imperativeProfile);

        return {
            profile,
        };
    }

    it("Checking common error handling", async () => {
        createGlobalMocks();

        mocked(vscode.window.showErrorMessage).mockResolvedValueOnce({ title: "Check Credentials" });
        const label = "invalidCred";

        await utils.errorHandling({ mDetails: { errorCode: 401 } }, label);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            `Invalid Credentials. Please ensure the username and password for ${label} are valid or this may lead to a lock-out.`,
            { modal: true },
            "Check Credentials"
        );
    });
    it("Checking USS error handling", async () => {
        createGlobalMocks();

        mocked(vscode.window.showErrorMessage).mockResolvedValueOnce({ title: "Check Credentials" });
        const label = "invalidCred [/tmp]";

        await utils.errorHandling({ mDetails: { errorCode: 401 } }, label);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            `Invalid Credentials. Please ensure the username and password for ${label} are valid or this may lead to a lock-out.`,
            { modal: true },
            "Check Credentials"
        );
    });
    it("Checking common error handling - Theia", async () => {
        // const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profile);
        mocked(vscode.window.showErrorMessage).mockResolvedValueOnce({ title: "Check Credentials" });
        mocked(utils.isTheia).mockReturnValue(true);
        // globalMocks.isTheia.mockReturnValue(true);
        const label = "invalidCred";

        await utils.errorHandling({ mDetails: { errorCode: 401 } }, label);

        // TODO: check why this return two messages?
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            `Invalid Credentials. Please ensure the username and password for ${label} are valid or this may lead to a lock-out.`,
            { modal: true },
            "Check Credentials"
        );
    });
});
