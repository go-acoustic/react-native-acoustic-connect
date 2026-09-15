# Copyright (C) 2024 Acoustic, L.P. All rights reserved.
#
# NOTICE: This file contains material that is confidential and proprietary to
# Acoustic, L.P. and/or other developers. No license is granted under any intellectual or
# industrial property rights of Acoustic, L.P. except as may be provided in an agreement with
# Acoustic, L.P. Any unauthorized copying or distribution of content from this file is
# prohibited.
#
#
# Created on 5/9/25.
#

project(AcousticConnectRN)
cmake_minimum_required(VERSION 3.9.0)

set (PACKAGE_NAME AcousticConnectRN)
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

# Define C++ library and add all sources
add_library(${PACKAGE_NAME} SHARED
        src/main/cpp/cpp-adapter.cpp
)

# Add Nitrogen specs :)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/AcousticConnectRN+autolinking.cmake)

# Set up local includes
include_directories(
        "src/main/cpp"
        "../cpp"
)

find_library(LOG_LIB log)

# Link all libraries together
target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        android                                   # <-- Android core
)
