package com.axiom.user.dto;

import lombok.Data;

@Data
public class UserDto {
    private String id;
    private String email;
    private String firstName;
    private String lastName;
    private String role;
    private String tier;
}

